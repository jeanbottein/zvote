use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity};

use crate::vote::{find_vote_by_id, find_vote_option_by_id, get_vote_options, VotingSystem};

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Mention {
    ToReject,    // À rejeter
    Passable,    // Passable
    Good,        // Assez Bien
    VeryGood,    // Bien
    Excellent,   // Très Bien
}

// Judgments table: one row per user per option for majority judgment votes
#[spacetimedb::table(
    name = judgment,
    public,
    index(name = by_option, btree(columns = [option_id])),
    index(name = by_option_and_user, btree(columns = [option_id, voter]))
)]
pub struct Judgment {
    #[primary_key]
    #[auto_inc]
    id: u64,
    pub option_id: u32,
    voter: Identity,
    mention: Mention,
}

#[spacetimedb::reducer]
pub fn cast_judgment(ctx: &ReducerContext, option_id: u32, mention: Mention) -> Result<(), String> {
    // 1. Find the vote option
    let Some(option) = find_vote_option_by_id(ctx, option_id) else {
        return Err("Vote option not found".into());
    };

    // 2. Find the parent vote and check its type
    let Some(vote) = find_vote_by_id(ctx, option.vote_id) else {
        // This should not happen if the option exists, but as a safeguard:
        return Err("Parent vote not found".into());
    };
    if vote.voting_system != VotingSystem::MajorityJudgment {
        return Err("This vote does not use majority judgment".into());
    }

    // 3. Check if this is the user's first judgment for this entire vote.
    let existing_judgments_for_vote: Vec<Judgment> = get_vote_options(ctx, vote.id)
        .flat_map(|opt| ctx.db.judgment().by_option().filter(opt.id).filter(|j| j.voter == ctx.sender))
        .collect();

    if existing_judgments_for_vote.is_empty() {
        // This is the first time the user is judging any option in this vote.
        // Default all options to `ToReject`.
        for opt in get_vote_options(ctx, vote.id) {
            ctx.db.judgment().insert(Judgment {
                id: 0,
                option_id: opt.id,
                voter: ctx.sender,
                mention: Mention::ToReject, // Default mention
            });
        }
    }

    // 4. Now, insert or update the specific judgment the user just cast.
    if let Some(existing_judgment) = ctx.db.judgment().by_option().filter(option_id).filter(|j| j.voter == ctx.sender).next() {
        // An entry for this specific option already exists (likely just created with ToReject).
        // Update it with the user's actual mention.
        if existing_judgment.mention != mention {
            ctx.db.judgment().id().update(Judgment {
                mention,
                ..existing_judgment
            });
        }
    } else {
        // This case should not be reached if the logic above is correct, but as a safeguard:
        ctx.db.judgment().insert(Judgment {
            id: 0,
            option_id,
            voter: ctx.sender,
            mention,
        });
    }

    Ok(())
}
