use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity, Filter, client_visibility_filter};

use crate::vote::{find_vote_by_id, find_vote_option_by_id, get_vote_options, VotingSystem};

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Mention {
    // Ordered from worst to best (lowest to highest)
    Bad,          // Bad
    Inadequate,   // Inadequate
    Passable,     // Passable
    Fair,         // Fair
    Good,         // Good
    VeryGood,     // Very Good
    Excellent,    // Excellent
}

/// A single judgment entry for batch submission
#[derive(SpacetimeType, Clone, Debug)]
pub struct JudgmentEntry {
    pub option_id: u32,
    pub mention: Mention,
}

// Judgments table: represents user's judgment ballots for specific options
// This stores individual ballot ratings, not aggregated results
// Public with RLS so each client only sees their own ballot rows
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

// RLS: a client may only see their own judgment ballot rows
#[client_visibility_filter]
const JUDGMENT_RLS: Filter = Filter::Sql(
    "SELECT judgment.* FROM judgment WHERE judgment.voter = :sender"
);

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
    // Counts per mention (ordered lowest to highest)
    pub bad: u32,
    pub inadequate: u32,
    pub passable: u32,
    pub fair: u32,
    pub good: u32,
    pub very_good: u32,
    pub excellent: u32,
    // Server stores only raw counts - all MJ logic is client-side!
}

// Server is now a pure database - no MJ logic!

fn recompute_mj_summary_for_vote(ctx: &ReducerContext, vote_id: u32) {
    // Collect options and their counts
    let options: Vec<_> = get_vote_options(ctx, vote_id).collect();
    let mut counts_vec: Vec<[u32; 7]> = Vec::with_capacity(options.len());
    let mut totals_vec: Vec<u32> = Vec::with_capacity(options.len());
    for opt in &options {
        let mut counts = [0u32; 7];
        let mut total: u32 = 0;
        for j in ctx.db.judgment().by_option().filter(opt.id) {
            match j.mention {
                Mention::Bad => counts[0] += 1,
                Mention::Inadequate => counts[1] += 1,
                Mention::Passable => counts[2] += 1,
                Mention::Fair => counts[3] += 1,
                Mention::Good => counts[4] += 1,
                Mention::VeryGood => counts[5] += 1,
                Mention::Excellent => counts[6] += 1,
            }
            total = total.saturating_add(1);
        }
        counts_vec.push(counts);
        totals_vec.push(total);
    }

    // Upsert summaries for each option - pure raw data storage
    for (opt, counts) in options.iter().zip(counts_vec.iter()) {
        let total = totals_vec[counts_vec.iter().position(|c| c == counts).unwrap_or(0)];
        
        if let Some(_existing) = ctx.db.mj_summary().option_id().find(opt.id) {
            ctx.db.mj_summary().option_id().update(MjSummary {
                option_id: opt.id,
                vote_id,
                total,
                bad: counts[0],
                inadequate: counts[1],
                passable: counts[2],
                fair: counts[3],
                good: counts[4],
                very_good: counts[5],
                excellent: counts[6],
            });
        } else {
            ctx.db.mj_summary().insert(MjSummary {
                option_id: opt.id,
                vote_id,
                total,
                bad: counts[0],
                inadequate: counts[1],
                passable: counts[2],
                fair: counts[3],
                good: counts[4],
                very_good: counts[5],
                excellent: counts[6],
            });
        }
    }
}
// Note: SpacetimeDB reducers cannot return data directly.
// Private tables are not accessible via client subscriptions.
// We need to use optimistic UI updates and server-side validation.

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
        // Default all options to `Bad`.
        for opt in get_vote_options(ctx, vote.id) {
            ctx.db.judgment().insert(Judgment {
                id: 0,
                option_id: opt.id,
                voter: ctx.sender,
                mention: Mention::Bad, // Default mention
            });
        }
        // Recompute summaries for the entire vote (ensures correct tie semantics)
        recompute_mj_summary_for_vote(ctx, vote.id);
    }

    // 4. Now, insert or update the specific judgment the user just cast.
    if let Some(existing_judgment) = ctx.db.judgment().by_option().filter(option_id).filter(|j| j.voter == ctx.sender).next() {
        // An entry for this specific option already exists (likely just created with Bad).
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

    // Recompute summaries for the entire vote (ensures correct tie semantics)
    recompute_mj_summary_for_vote(ctx, option.vote_id);

    Ok(())
}


#[spacetimedb::reducer]
pub fn withdraw_judgments(ctx: &ReducerContext, vote_id: u32) -> Result<(), String> {
    // Ensure vote exists and is Majority Judgment
    let Some(vote) = find_vote_by_id(ctx, vote_id) else {
        return Err("Vote not found".into());
    };
    if vote.voting_system != VotingSystem::MajorityJudgment {
        return Err("This vote does not use majority judgment".into());
    }

    // For each option of the vote, delete the caller's judgment(s)
    for opt in get_vote_options(ctx, vote_id) {
        // remove all rows for this voter on this option (normally at most one)
        let rows: Vec<_> = ctx
            .db
            .judgment()
            .by_option()
            .filter(opt.id)
            .filter(|j| j.voter == ctx.sender)
            .collect();
        for r in rows {
            ctx.db.judgment().delete(r);
        }
    }

    // Recompute summaries for the vote after changes
    recompute_mj_summary_for_vote(ctx, vote_id);

    Ok(())
}

// ================================
// Clear Ballot Terminology Aliases
// ================================

/// Submit a judgment ballot for a specific option (clearer alias for cast_judgment)
#[spacetimedb::reducer]
pub fn submit_judgment_ballot(ctx: &ReducerContext, option_id: u32, mention: Mention) -> Result<(), String> {
    cast_judgment(ctx, option_id, mention)
}

/// Submit a complete judgment ballot for all options in a vote in one transaction.
/// This ensures atomicity and validates that all options have been judged.
/// 
/// Parameters:
/// - vote_id: The vote to submit the ballot for
/// - judgments: Vector of JudgmentEntry, one for each option
/// 
/// Returns an error if:
/// - The vote doesn't exist or isn't a Majority Judgment vote
/// - The number of judgments doesn't match the number of options
/// - Any option_id is invalid or doesn't belong to this vote
#[spacetimedb::reducer]
pub fn submit_complete_judgment_ballot(
    ctx: &ReducerContext,
    vote_id: u32,
    judgments: Vec<JudgmentEntry>
) -> Result<(), String> {
    // 1. Validate the vote exists and is Majority Judgment
    let Some(vote) = find_vote_by_id(ctx, vote_id) else {
        return Err("Vote not found".into());
    };
    if vote.voting_system != VotingSystem::MajorityJudgment {
        return Err("This vote does not use majority judgment".into());
    }

    // 2. Get all options for this vote and validate completeness
    let options: Vec<_> = get_vote_options(ctx, vote_id).collect();
    if judgments.len() != options.len() {
        return Err(format!(
            "Incomplete ballot: expected {} judgments but received {}",
            options.len(),
            judgments.len()
        ));
    }

    // 3. Validate all option_ids belong to this vote
    for entry in &judgments {
        let valid = options.iter().any(|opt| opt.id == entry.option_id);
        if !valid {
            return Err(format!("Option {} does not belong to vote {}", entry.option_id, vote_id));
        }
    }

    // 4. Check for duplicate option_ids
    let mut seen_ids = std::collections::HashSet::new();
    for entry in &judgments {
        if !seen_ids.insert(entry.option_id) {
            return Err(format!("Duplicate judgment for option {}", entry.option_id));
        }
    }

    // 5. Delete all existing judgments for this voter on this vote (if any)
    for opt in &options {
        let rows: Vec<_> = ctx
            .db
            .judgment()
            .by_option()
            .filter(opt.id)
            .filter(|j| j.voter == ctx.sender)
            .collect();
        for r in rows {
            ctx.db.judgment().delete(r);
        }
    }

    // 6. Insert all new judgments in one transaction
    for entry in judgments {
        ctx.db.judgment().insert(Judgment {
            id: 0,
            option_id: entry.option_id,
            voter: ctx.sender,
            mention: entry.mention,
        });
    }

    // 7. Recompute summaries once for the entire vote
    recompute_mj_summary_for_vote(ctx, vote_id);

    Ok(())
}
