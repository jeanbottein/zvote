use spacetimedb::{ReducerContext, Table, Identity, Timestamp, Filter, client_visibility_filter};
use std::collections::HashSet;

use crate::vote::{find_vote_by_id, find_vote_option_by_id, set_vote_option_approvals_count, vote_option_vote_id, vote_option_approvals_count, VotingSystem};
// Bring the `approval` table trait into scope for method resolution on `ctx.db.approval()`.
use self::approval as approval_table;

// Approvals table: represents user's approval ballots for specific options
// This stores individual ballot choices, not aggregated results
// Public with RLS: clients only see their own ballot rows via client visibility filters
#[spacetimedb::table(
    name = approval,
    public,
    index(name = by_vote, btree(columns = [vote_id])),
    index(name = by_vote_and_option, btree(columns = [vote_id, option_id])),
    index(name = by_vote_and_voter, btree(columns = [vote_id, voter])),
    index(name = by_vote_voter_option, btree(columns = [vote_id, voter, option_id]))
)]
pub struct Approval {
    vote_id: u32,
    option_id: u32,
    voter: Identity,
    ts: Timestamp,
}

// RLS: a client may only see their own approval ballot rows
#[client_visibility_filter]
const APPROVAL_RLS: Filter = Filter::Sql(
    "SELECT approval.* FROM approval WHERE approval.voter = :sender"
);

// Reducer: approve a single option
#[spacetimedb::reducer]
pub fn approve(ctx: &ReducerContext, vote_id: u32, option_id: u32) -> Result<(), String> {
    let Some(opt) = find_vote_option_by_id(ctx, option_id) else {
        return Err("Option not found".into());
    };
    if vote_option_vote_id(&opt) != vote_id {
        return Err("Option does not belong to the specified vote".into());
    }

    // Ensure this is an approval-based vote
    let Some(vote) = find_vote_by_id(ctx, vote_id) else {
        return Err("Vote not found".into());
    };
    if vote.voting_system != VotingSystem::Approval {
        return Err("This vote does not use approval voting".into());
    }

    // Check if already approved
    if ctx
        .db
        .approval()
        .by_vote_voter_option()
        .filter((vote_id, ctx.sender, option_id))
        .next()
        .is_some()
    {
        return Ok(());
    }

    // Insert approval
    ctx.db.approval().insert(Approval {
        vote_id,
        option_id,
        voter: ctx.sender,
        ts: ctx.timestamp,
    });

    // Increment count
    let new_count = vote_option_approvals_count(&opt).saturating_add(1);
    set_vote_option_approvals_count(ctx, opt, new_count);
    Ok(())
}

// Reducer: remove approval for a single option
#[spacetimedb::reducer]
pub fn unapprove(ctx: &ReducerContext, vote_id: u32, option_id: u32) -> Result<(), String> {
    let Some(opt) = find_vote_option_by_id(ctx, option_id) else {
        return Err("Option not found".into());
    };
    if vote_option_vote_id(&opt) != vote_id {
        return Err("Option does not belong to the specified vote".into());
    }

    // Ensure this is an approval-based vote
    let Some(vote) = find_vote_by_id(ctx, vote_id) else {
        return Err("Vote not found".into());
    };
    if vote.voting_system != VotingSystem::Approval {
        return Err("This vote does not use approval voting".into());
    }

    // Find approval row to delete
    if let Some(a) = ctx
        .db
        .approval()
        .by_vote_voter_option()
        .filter((vote_id, ctx.sender, option_id))
        .next()
    {
        ctx.db.approval().delete(a);
        let new_count = vote_option_approvals_count(&opt).saturating_sub(1);
        set_vote_option_approvals_count(ctx, opt, new_count);
    }
    Ok(())
}

// Reducer: set the full approval set for the caller for a given vote
#[spacetimedb::reducer]
pub fn set_approvals(ctx: &ReducerContext, vote_id: u32, option_ids: Vec<u32>) -> Result<(), String> {
    // Validate vote exists
    // Validate vote exists and is of the correct type
    let Some(vote) = find_vote_by_id(ctx, vote_id) else {
        return Err("Vote not found".into());
    };
    if vote.voting_system != VotingSystem::Approval {
        return Err("This vote does not use approval voting".into());
    }

    // Normalize option set and ensure they all belong to the vote
    let mut desired: HashSet<u32> = HashSet::new();
    for oid in option_ids {
        if let Some(o) = find_vote_option_by_id(ctx, oid) {
            if vote_option_vote_id(&o) != vote_id {
                return Err(format!("Option {} does not belong to vote {}", oid, vote_id));
            }
            desired.insert(oid);
        } else {
            return Err(format!("Option {} not found", oid));
        }
    }
    if desired.len() > 20 {
        return Err("Cannot approve more than 20 options in a single vote".into());
    }

    // Current approvals for caller on this vote
    let mut current: HashSet<u32> = HashSet::new();
    for a in ctx.db.approval().by_vote_and_voter().filter((vote_id, ctx.sender)) {
        current.insert(a.option_id);
    }

    // Compute diffs
    let (to_add, to_remove) = compute_approval_diffs(&current, &desired);

    // Apply removals first
    for oid in to_remove {
        // Find approval row
        if let Some(a) = ctx
            .db
            .approval()
            .by_vote_voter_option()
            .filter((vote_id, ctx.sender, oid))
            .next()
        {
            ctx.db.approval().delete(a);
            if let Some(opt) = find_vote_option_by_id(ctx, oid) {
                let new_count = vote_option_approvals_count(&opt).saturating_sub(1);
                set_vote_option_approvals_count(ctx, opt, new_count);
            }
        }
    }
    // Then apply additions
    for oid in to_add {
        // Option existence already validated
        ctx.db.approval().insert(Approval {
            vote_id,
            option_id: oid,
            voter: ctx.sender,
            ts: ctx.timestamp,
        });
        if let Some(opt) = find_vote_option_by_id(ctx, oid) {
            let new_count = vote_option_approvals_count(&opt).saturating_add(1);
            set_vote_option_approvals_count(ctx, opt, new_count);
        }
    }
    Ok(())
}

// Note: SpacetimeDB reducers cannot return data directly.
// Private tables are not accessible via client subscriptions.
// We need to use optimistic UI updates and server-side validation.

/// Compute which approvals to add and which to remove to transform `current` into `desired`.
pub(crate) fn compute_approval_diffs(current: &HashSet<u32>, desired: &HashSet<u32>) -> (Vec<u32>, Vec<u32>) {
    let to_add: Vec<u32> = desired.difference(current).copied().collect();
    let to_remove: Vec<u32> = current.difference(desired).copied().collect();
    (to_add, to_remove)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_diffs_basic() {
        let current: HashSet<u32> = [1, 2, 3].into_iter().collect();
        let desired: HashSet<u32> = [2, 3, 4].into_iter().collect();
        let (add, remove) = compute_approval_diffs(&current, &desired);
        assert!(add.contains(&4) && add.len() == 1);
        assert!(remove.contains(&1) && remove.len() == 1);
    }

    #[test]
    fn compute_diffs_no_change() {
        let current: HashSet<u32> = [1, 2].into_iter().collect();
        let desired: HashSet<u32> = [1, 2].into_iter().collect();
        let (add, remove) = compute_approval_diffs(&current, &desired);
        assert!(add.is_empty());
        assert!(remove.is_empty());
    }
}

// ================================
// Clear Ballot Terminology Aliases
// ================================

/// Submit an approval ballot for a single option (clearer alias for approve)
#[spacetimedb::reducer]
pub fn submit_approval_ballot(ctx: &ReducerContext, vote_id: u32, option_id: u32) -> Result<(), String> {
    approve(ctx, vote_id, option_id)
}

/// Withdraw approval ballot for a single option (clearer alias for unapprove)
#[spacetimedb::reducer]
pub fn withdraw_approval_ballot(ctx: &ReducerContext, vote_id: u32, option_id: u32) -> Result<(), String> {
    unapprove(ctx, vote_id, option_id)
}

/// Set complete approval ballot for a vote (clearer alias for set_approvals)
#[spacetimedb::reducer]
pub fn set_approval_ballot(ctx: &ReducerContext, vote_id: u32, option_ids: Vec<u32>) -> Result<(), String> {
    set_approvals(ctx, vote_id, option_ids)
}
