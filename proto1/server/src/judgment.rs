use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity, Filter, client_visibility_filter};

use crate::vote::{find_vote_by_id, find_vote_option_by_id, get_vote_options, VotingSystem};

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Mention {
    ToReject,    // À rejeter
    Passable,    // Passable
    Good,        // Assez Bien
    VeryGood,    // Bien
    Excellent,   // Très Bien
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

// Compute majority and optional second for a whole vote's options, using Majority Judgment tie-breaking guidance:
// - majority: median grade (lower median for even totals)
// - second: only needed for options tied at the top majority grade to enable tie-breaking
fn compute_majorities_and_seconds(counts_list: &[[u32; 5]]) -> Vec<(Mention, Option<Mention>)> {
    let totals: Vec<u32> = counts_list.iter().map(|c| c.iter().sum()).collect();
    let majorities: Vec<Mention> = counts_list
        .iter()
        .zip(totals.iter().copied())
        .map(|(c, t)| compute_majority_from_counts(c, t))
        .collect();

    // Highest majority grade among options
    let best_majority = majorities.iter().copied().max().unwrap_or(Mention::ToReject);
    let winners_count = majorities.iter().filter(|&&m| m == best_majority).count();
    let have_tie_among_winners = winners_count > 1;

    let seconds: Vec<Option<Mention>> = counts_list
        .iter()
        .zip(totals.iter().copied())
        .zip(majorities.iter().copied())
        .map(|((c, t), m)| {
            if have_tie_among_winners && m == best_majority {
                compute_second_from_counts(c, t, m)
            } else {
                None
            }
        })
        .collect();

    majorities.into_iter().zip(seconds.into_iter()).collect()
}

fn recompute_mj_summary_for_vote(ctx: &ReducerContext, vote_id: u32) {
    // Collect options and their counts
    let options: Vec<_> = get_vote_options(ctx, vote_id).collect();
    let mut counts_vec: Vec<[u32; 5]> = Vec::with_capacity(options.len());
    let mut totals_vec: Vec<u32> = Vec::with_capacity(options.len());
    for opt in &options {
        let mut counts = [0u32; 5];
        let mut total: u32 = 0;
        for j in ctx.db.judgment().by_option().filter(opt.id) {
            match j.mention {
                Mention::ToReject => counts[0] += 1,
                Mention::Passable => counts[1] += 1,
                Mention::Good => counts[2] += 1,
                Mention::VeryGood => counts[3] += 1,
                Mention::Excellent => counts[4] += 1,
            }
            total = total.saturating_add(1);
        }
        counts_vec.push(counts);
        totals_vec.push(total);
    }

    let majorities_seconds = compute_majorities_and_seconds(&counts_vec);

    // Upsert summaries for each option
    for ((opt, counts), (majority, second)) in options.iter().zip(counts_vec.iter()).zip(majorities_seconds.into_iter()) {
        let total = totals_vec[counts_vec.iter().position(|c| c == counts).unwrap_or(0)];
        if let Some(existing) = ctx.db.mj_summary().option_id().find(opt.id) {
            ctx.db.mj_summary().option_id().update(MjSummary {
                option_id: opt.id,
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
                option_id: opt.id,
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
}

// Note: SpacetimeDB reducers cannot return data directly.
// Private tables are not accessible via client subscriptions.
// We need to use optimistic UI updates and server-side validation.

fn recompute_mj_summary_for_option(ctx: &ReducerContext, option_id: u32) {
    let vote_id = match find_vote_option_by_id(ctx, option_id) { Some(opt) => opt.vote_id, None => 0 };
    if vote_id != 0 {
        recompute_mj_summary_for_vote(ctx, vote_id);
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

    fn counts(tr: u32, pa: u32, gd: u32, vg: u32, ex: u32) -> [u32; 5] {
        [tr, pa, gd, vg, ex]
    }

    #[test]
    fn test_majority_median_odd_total() {
        // 3 voters: Good, VeryGood, Excellent => median is VeryGood
        let c = counts(0, 0, 1, 1, 1);
        let maj = compute_majority_from_counts(&c, 3);
        assert_eq!(maj, Mention::VeryGood);
    }

    #[test]
    fn test_majority_median_even_total_lower_median() {
        // 4 voters: Good, Good, VeryGood, Excellent => lower median is Good
        let c = counts(0, 0, 2, 1, 1);
        let maj = compute_majority_from_counts(&c, 4);
        assert_eq!(maj, Mention::Good);
    }

    #[test]
    fn test_second_computation_example() {
        // counts: Good(1), VeryGood(1), Excellent(1)
        // majority: VeryGood; second after removing one VeryGood => Good
        let c = counts(0, 0, 1, 1, 1);
        let maj = compute_majority_from_counts(&c, 3);
        assert_eq!(maj, Mention::VeryGood);
        let sec = compute_second_from_counts(&c, 3, maj);
        assert_eq!(sec, Some(Mention::Good));
    }

    #[test]
    fn test_second_only_for_tie_of_winners() {
        // Option A: [Good(1), VeryGood(1), Excellent(1)] => majority VeryGood, second Good
        // Option B: [VeryGood(2), Excellent(1)] => majority VeryGood, second VeryGood
        // Option C: [Good(2), VeryGood(1)] => majority Good
        let a = counts(0, 0, 1, 1, 1);
        let b = counts(0, 0, 0, 2, 1);
        let c = counts(0, 0, 2, 1, 0);
        let out = compute_majorities_and_seconds(&[a, b, c]);

        assert_eq!(out[0].0, Mention::VeryGood);
        assert_eq!(out[1].0, Mention::VeryGood);
        assert_eq!(out[2].0, Mention::Good);

        // Winners tie among A and B at VeryGood => they get a second mention
        assert_eq!(out[0].1, Some(Mention::Good));
        assert_eq!(out[1].1, Some(Mention::VeryGood));
        // Non-winner C gets no second mention stored
        assert_eq!(out[2].1, None);
    }

    #[test]
    fn test_no_second_when_unique_winner() {
        // Option A: majority VeryGood
        // Option B: majority Excellent (unique winner)
        let a = counts(0, 0, 1, 2, 0);
        let b = counts(0, 0, 0, 1, 2);
        let out = compute_majorities_and_seconds(&[a, b]);
        assert_eq!(out[0].0, Mention::VeryGood);
        assert_eq!(out[1].0, Mention::Excellent);
        // Unique winner => no second stored for either
        assert_eq!(out[0].1, None);
        assert_eq!(out[1].1, None);
    }
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
