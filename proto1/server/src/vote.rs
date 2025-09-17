use spacetimedb::{ReducerContext, Table, Identity, Timestamp};
use std::collections::HashSet;

use crate::utils::normalize_label;
// Bring approval table trait into scope so `ctx.db.approval()` is available.
use crate::approval::approval;

// Votes table: one row per vote
#[spacetimedb::table(
    name = vote,
    public,
    index(name = by_creator, btree(columns = [creator])),
    index(name = by_creator_and_created, btree(columns = [creator, created_at]))
)]
pub struct Vote {
    #[auto_inc]
    #[primary_key]
    id: u64,
    creator: Identity,
    title: String,
    public: bool,
    created_at: Timestamp,
}

// Options table: up to 20 per vote
#[spacetimedb::table(
    name = vote_option,
    public,
    index(name = by_vote, btree(columns = [vote_id])),
    index(name = by_vote_and_label, btree(columns = [vote_id, label])),
    index(name = by_vote_and_count, btree(columns = [vote_id, approvals_count]))
)]
pub struct VoteOption {
    #[auto_inc]
    #[primary_key]
    id: u32,
    vote_id: u64,
    label: String,
    approvals_count: u32,
    order_index: u32,
}

/// Validate, normalize, deduplicate, and return the cleaned list of options.
/// - Requires 1..=20 options after cleaning
/// - Uses `normalize_label` to trim/validate each option
/// - Deduplicates options case-sensitively after normalization
pub(crate) fn validate_and_clean_options(options: Vec<String>) -> Result<Vec<String>, String> {
    if options.is_empty() {
        return Err("At least one option is required".into());
    }
    if options.len() > 20 {
        return Err("At most 20 options are allowed".into());
    }

    let mut seen = HashSet::<String>::new();
    let mut cleaned: Vec<String> = Vec::with_capacity(options.len());
    for opt in options {
        let o = normalize_label(&opt)?;
        if seen.insert(o.clone()) {
            cleaned.push(o);
        }
    }
    if cleaned.is_empty() {
        return Err("All options were empty/duplicate after normalization".into());
    }
    Ok(cleaned)
}

// Reducer: create a vote with up to 20 options
#[spacetimedb::reducer]
pub fn create_vote(
    ctx: &ReducerContext,
    title: String,
    options: Vec<String>,
    is_public: Option<bool>,
) -> Result<(), String> {
    let title = normalize_label(&title)?;

    let cleaned = validate_and_clean_options(options)?;

    let vote = ctx.db.vote().insert(Vote {
        id: 0,
        creator: ctx.sender,
        title,
        public: is_public.unwrap_or(true),
        created_at: ctx.timestamp,
    });

    for (idx, label) in cleaned.into_iter().enumerate() {
        ctx.db.vote_option().insert(VoteOption {
            id: 0,
            vote_id: vote.id,
            label,
            approvals_count: 0,
            order_index: idx as u32,
        });
    }
    Ok(())
}

// Reducer: delete a vote (only creator can delete)
#[spacetimedb::reducer]
pub fn delete_vote(ctx: &ReducerContext, vote_id: u64) -> Result<(), String> {
    if let Some(vote) = ctx.db.vote().id().find(vote_id) {
        if vote.creator != ctx.sender {
            return Err("Only the vote creator can delete this vote".into());
        }

        // Delete approvals
        for a in ctx.db.approval().by_vote().filter(vote_id) {
            ctx.db.approval().delete(a);
        }
        // Delete options
        for opt in ctx.db.vote_option().by_vote().filter(vote_id) {
            ctx.db.vote_option().delete(opt);
        }
        // Delete vote itself
        ctx.db.vote().delete(vote);
        Ok(())
    } else {
        Err("Vote not found".into())
    }
}

// --- Public helpers for cross-module access to primary-key operations ---

/// Return true if a vote with the given id exists.
pub fn vote_exists(ctx: &ReducerContext, vote_id: u64) -> bool {
    ctx.db.vote().id().find(vote_id).is_some()
}

/// Find a vote by id.
pub fn find_vote_by_id(ctx: &ReducerContext, vote_id: u64) -> Option<Vote> {
    ctx.db.vote().id().find(vote_id)
}

/// Find a vote option by primary key.
pub fn find_vote_option_by_id(ctx: &ReducerContext, option_id: u32) -> Option<VoteOption> {
    ctx.db.vote_option().id().find(option_id)
}

/// Update a vote option's approvals_count to a new value.
pub fn set_vote_option_approvals_count(ctx: &ReducerContext, opt: VoteOption, new_count: u32) {
    ctx.db.vote_option().id().update(VoteOption {
        approvals_count: new_count,
        ..opt
    });
}

/// Get the parent vote id for a vote option.
pub fn vote_option_vote_id(opt: &VoteOption) -> u64 {
    opt.vote_id
}

/// Get the current approvals_count for a vote option.
pub fn vote_option_approvals_count(opt: &VoteOption) -> u32 {
    opt.approvals_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_and_clean_rejects_empty() {
        let res = validate_and_clean_options(vec![]);
        assert!(res.is_err());
    }

    #[test]
    fn validate_and_clean_rejects_too_many() {
        let options: Vec<String> = (0..21).map(|i| format!("opt{}", i)).collect();
        let res = validate_and_clean_options(options);
        assert!(res.is_err());
    }

    #[test]
    fn validate_and_clean_trims_and_dedupes() {
        let res = validate_and_clean_options(vec![
            "  Pizza  ".into(),
            "Pizza".into(),
            "Sushi".into(),
            "  ".into(), // becomes empty and will be rejected by normalize_label
        ]);
        assert!(res.is_err(), "Empty string should cause error");

        let res = validate_and_clean_options(vec![
            "  Pizza  ".into(),
            "Pizza".into(),
            "Sushi".into(),
            "Salad".into(),
        ])
        .unwrap();
        assert_eq!(res, vec!["Pizza", "Sushi", "Salad"]);
    }
}
