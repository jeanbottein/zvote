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

// Precomputed summary for Majority Judgment per option
#[spacetimedb::table(
    name = mj_summary,
    public,
    index(name = by_vote, btree(columns = [vote_id]))
)]
pub struct MjSummary {
    // Use option_id as primary key for convenient upserts
    #[primary_key]
    pub option_id: u32,
    pub vote_id: u32,
    pub total: u32,
    pub to_reject: u32,
    pub passable: u32,
    pub good: u32,
    pub very_good: u32,
    pub excellent: u32,
    pub majority: Mention,
    pub second: Option<Mention>,
}

fn compute_majority_from_counts(counts: &[u32; 5], total: u32) -> Mention {
    // Order: ToReject(0) < Passable(1) < Good(2) < VeryGood(3) < Excellent(4)
    let order = [Mention::ToReject, Mention::Passable, Mention::Good, Mention::VeryGood, Mention::Excellent];
    if total == 0 {
        return Mention::ToReject; // default when no judgments
    }
    let target = (total + 1) / 2; // median position (1-indexed)
    let mut cum = 0u32;
    for (i, m) in order.iter().enumerate() {
        cum = cum.saturating_add(counts[i]);
        if cum >= target {
            return *m;
        }
    }
    // Fallback (shouldn't happen)
    Mention::Excellent
}

fn compute_second_from_counts(counts: &[u32; 5], total: u32, majority: Mention) -> Option<Mention> {
    if total <= 1 { return None; }
    let mut counts2 = *counts;
    let idx = match majority {
        Mention::ToReject => 0,
        Mention::Passable => 1,
        Mention::Good => 2,
        Mention::VeryGood => 3,
        Mention::Excellent => 4,
    };
    if counts2[idx] == 0 { return None; }
    counts2[idx] -= 1;
    let t2 = total - 1;
    Some(compute_majority_from_counts(&counts2, t2))
}

fn recompute_mj_summary_for_option(ctx: &ReducerContext, option_id: u32) {
    // Gather counts
    let mut counts = [0u32; 5];
    let mut total: u32 = 0;
    for j in ctx.db.judgment().by_option().filter(option_id) {
        match j.mention {
            Mention::ToReject => counts[0] += 1,
            Mention::Passable => counts[1] += 1,
            Mention::Good => counts[2] += 1,
            Mention::VeryGood => counts[3] += 1,
            Mention::Excellent => counts[4] += 1,
        }
        total = total.saturating_add(1);
    }
    let majority = compute_majority_from_counts(&counts, total);
    let second = compute_second_from_counts(&counts, total, majority);
    let vote_id = match find_vote_option_by_id(ctx, option_id) { Some(opt) => opt.vote_id, None => 0 };

    // Upsert summary row
    if let Some(existing) = ctx.db.mj_summary().id().find(option_id) {
        ctx.db.mj_summary().id().update(MjSummary {
            option_id,
            vote_id,
            total,
            to_reject: counts[0],
            passable: counts[1],
            good: counts[2],
            very_good: counts[3],
            excellent: counts[4],
            majority,
            second,
            ..existing
        });
    } else {
        ctx.db.mj_summary().insert(MjSummary {
            option_id,
            vote_id,
            total,
            to_reject: counts[0],
            passable: counts[1],
            good: counts[2],
            very_good: counts[3],
            excellent: counts[4],
            majority,
            second,
        });
    }
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
                option_id: opt.id,
                voter: ctx.sender,
                mention: Mention::ToReject, // Default mention
            });
        }
        // Recompute summaries for all options of this vote
        for opt in get_vote_options(ctx, vote.id) {
            recompute_mj_summary_for_option(ctx, opt.id);
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
            option_id,
            voter: ctx.sender,
            mention,
        });
    }

    // Recompute summary for this option
    recompute_mj_summary_for_option(ctx, option_id);

    Ok(())
}
