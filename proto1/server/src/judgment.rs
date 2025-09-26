use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity, Filter, client_visibility_filter};

use crate::vote::{find_vote_by_id, find_vote_option_by_id, get_vote_options, VotingSystem};

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Mention {
    // Ordered from worst to best (lowest to highest)
    ToReject,     // À rejeter
    Insufficient, // Insuffisant
    OnlyAverage,  // Médiocre / Moyen
    GoodEnough,   // Assez Bien / Suffisant
    Good,         // Bien
    VeryGood,     // Très Bien
    Excellent,    // Excellent
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
    pub to_reject: u32,
    pub insufficient: u32,
    pub only_average: u32,
    pub good_enough: u32,
    pub good: u32,
    pub very_good: u32,
    pub excellent: u32,
    // Majority mention (median using lower median for even totals) - canonical, stored server-side
    pub majority: Mention,
}

fn compute_majority_from_counts(counts: &[u32; 7], total: u32) -> Mention {
    // Order: ToReject(0) < Insufficient(1) < OnlyAverage(2) < GoodEnough(3) < Good(4) < VeryGood(5) < Excellent(6)
    let order = [
        Mention::ToReject,
        Mention::Insufficient,
        Mention::OnlyAverage,
        Mention::GoodEnough,
        Mention::Good,
        Mention::VeryGood,
        Mention::Excellent,
    ];
    if total == 0 {
        return Mention::ToReject; // default when no judgments
    }

    let target = (total + 1) / 2; // median position (1-indexed), lower median for even totals
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

// Server only computes and stores the canonical majority (median). Tie-breaking is client-side.

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
                Mention::ToReject => counts[0] += 1,
                Mention::Insufficient => counts[1] += 1,
                Mention::OnlyAverage => counts[2] += 1,
                Mention::GoodEnough => counts[3] += 1,
                Mention::Good => counts[4] += 1,
                Mention::VeryGood => counts[5] += 1,
                Mention::Excellent => counts[6] += 1,
            }
            total = total.saturating_add(1);
        }
        counts_vec.push(counts);
        totals_vec.push(total);
    }

    // Upsert summaries for each option
    for (opt, counts) in options.iter().zip(counts_vec.iter()) {
        let total = totals_vec[counts_vec.iter().position(|c| c == counts).unwrap_or(0)];
        let majority = compute_majority_from_counts(counts, total);
        if let Some(existing) = ctx.db.mj_summary().option_id().find(opt.id) {
            ctx.db.mj_summary().option_id().update(MjSummary {
                option_id: opt.id,
                vote_id,
                total,
                to_reject: counts[0],
                insufficient: counts[1],
                only_average: counts[2],
                good_enough: counts[3],
                good: counts[4],
                very_good: counts[5],
                excellent: counts[6],
                majority,
                ..existing
            });
        } else {
            ctx.db.mj_summary().insert(MjSummary {
                option_id: opt.id,
                vote_id,
                total,
                to_reject: counts[0],
                insufficient: counts[1],
                only_average: counts[2],
                good_enough: counts[3],
                good: counts[4],
                very_good: counts[5],
                excellent: counts[6],
                majority,
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
        // Default all options to `ToReject`.
        for opt in get_vote_options(ctx, vote.id) {
            ctx.db.judgment().insert(Judgment {
                id: 0,
                option_id: opt.id,
                voter: ctx.sender,
                mention: Mention::ToReject, // Default mention
            });
        }
        // Recompute summaries for the entire vote (ensures correct tie semantics)
        recompute_mj_summary_for_vote(ctx, vote.id);
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

    // Recompute summaries for the entire vote (ensures correct tie semantics)
    recompute_mj_summary_for_vote(ctx, option.vote_id);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to build 7-level counts array in worst..best order
    fn counts(tr: u32, insuff: u32, only_avg: u32, good_enough: u32, gd: u32, vg: u32, ex: u32) -> [u32; 7] {
        [tr, insuff, only_avg, good_enough, gd, vg, ex]
    }

    #[test]
    fn test_majority_median_odd_total() {
        // 3 voters: Good, VeryGood, Excellent => median is VeryGood
        let c = counts(0, 0, 0, 0, 1, 1, 1);
        let maj = compute_majority_from_counts(&c, 3);
        assert_eq!(maj, Mention::VeryGood);
    }

    #[test]
    fn test_majority_median_even_total_lower_median() {
        // 4 voters: Good, Good, VeryGood, Excellent => lower median is Good
        let c = counts(0, 0, 0, 0, 2, 1, 1);
        let maj = compute_majority_from_counts(&c, 4);
        assert_eq!(maj, Mention::Good);
    }

    // No server-side tests for tie-break 'second' — tie logic is client-side.
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
