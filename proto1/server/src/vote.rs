use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity, Timestamp};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use blake3;
use std::collections::HashSet;

use crate::utils::normalize_label;
// Bring table traits into scope for method resolution on `ctx.db.*()`.
use crate::approval::approval;
use crate::judgment::judgment;
use crate::judgment::mj_summary as mj_summary_table;

// Maximum number of options allowed per vote (server-enforced)
pub const MAX_OPTIONS: usize = 20;

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq)]
pub enum VotingSystem {
    Approval,
    MajorityJudgment,
}

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq)]
pub enum Visibility {
    Public,
    Private,
    Unlisted,
}

// Votes table: one row per vote
#[spacetimedb::table(
    name = vote,
    public,
    index(name = by_creator, btree(columns = [creator])),
    index(name = by_creator_and_created, btree(columns = [creator, created_at])),
    index(name = by_token, btree(columns = [token]))
)]
pub struct Vote {
    #[auto_inc]
    #[primary_key]
    pub id: u32,
    pub creator: Identity,
    pub title: String,
    pub visibility: Visibility,
    pub created_at: Timestamp,
    pub token: String,
    pub voting_system: VotingSystem,
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
    pub id: u32,
    pub vote_id: u32,
    pub label: String,
    pub approvals_count: u32,
    pub order_index: u32,
}

/// Validate, normalize, deduplicate, and return the cleaned list of options.
/// - Requires at least 1 option after cleaning
/// - If more than MAX_OPTIONS options remain after cleaning, extras are ignored (truncated)
/// - Uses `normalize_label` to trim/validate each option
/// - Deduplicates options case-sensitively after normalization
pub(crate) fn validate_and_clean_options(options: Vec<String>) -> Result<Vec<String>, String> {
    if options.is_empty() {
        return Err("At least one option is required".into());
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
    if cleaned.len() > MAX_OPTIONS {
        cleaned.truncate(MAX_OPTIONS);
    }
    Ok(cleaned)
}

// Reducer: create a vote (options beyond MAX_OPTIONS are ignored)
#[spacetimedb::reducer]
pub fn create_vote(
    ctx: &ReducerContext,
    title: String,
    options: Vec<String>,
    visibility: Option<Visibility>,
    voting_system: Option<VotingSystem>,
) -> Result<(), String> {
    let title = normalize_label(&title)?;

    let cleaned = validate_and_clean_options(options)?;

    // Pre-generate a unique token before inserting the vote
    let temp_vote_for_token = Vote {
        id: 0, // Temp value, will be auto-incremented on insert
        creator: ctx.sender,
        title: title.clone(),
        visibility: visibility.unwrap_or(Visibility::Public),
        created_at: ctx.timestamp,
        token: String::new(), // Placeholder
        voting_system: voting_system.unwrap_or(VotingSystem::Approval),
    };

    let mut token = compute_share_token(ctx, &temp_vote_for_token, 0);
    let mut salt: u32 = 1;
    while ctx.db.vote().by_token().filter(token.as_str()).next().is_some() {
        token = compute_share_token(ctx, &temp_vote_for_token, salt);
        salt = salt.wrapping_add(1);
    }

    let vote = ctx.db.vote().insert(Vote {
        id: 0,
        creator: ctx.sender,
        title,
        visibility: visibility.unwrap_or(Visibility::Public),
        created_at: ctx.timestamp,
        token,
        voting_system: voting_system.unwrap_or(VotingSystem::Approval),
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


// Public server info table so clients can read max options via subscription
#[spacetimedb::table(name = server_info, public)]
pub struct ServerInfo {
    #[primary_key]
    id: u8, // singleton: id = 1
    max_options: u32,
}

/// Ensure the ServerInfo singleton row exists (id=1), seeding max_options.
#[spacetimedb::reducer]
pub fn ensure_server_info(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.server_info().id().find(1).is_none() {
        ctx.db.server_info().insert(ServerInfo { id: 1, max_options: MAX_OPTIONS as u32 });
    }
    Ok(())
}

// Reducer: delete a vote (only creator can delete)
#[spacetimedb::reducer]
pub fn delete_vote(ctx: &ReducerContext, vote_id: u32) -> Result<(), String> {
    if let Some(vote) = ctx.db.vote().id().find(vote_id) {
        if vote.creator != ctx.sender {
            return Err("Only the vote creator can delete this vote".into());
        }

        // Delete MJ summaries for this vote
        for s in ctx.db.mj_summary().by_vote().filter(vote_id) {
            ctx.db.mj_summary().delete(s);
        }

        // Delete approvals
        for a in ctx.db.approval().by_vote().filter(vote_id) {
            ctx.db.approval().delete(a);
        }
        // Delete options and their associated judgments
        for opt in ctx.db.vote_option().by_vote().filter(vote_id) {
            // Delete judgments for this option
            for j in ctx.db.judgment().by_option().filter(opt.id) {
                ctx.db.judgment().delete(j);
            }
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
pub fn vote_exists(ctx: &ReducerContext, vote_id: u32) -> bool {
    ctx.db.vote().id().find(vote_id).is_some()
}

/// Find a vote by id.
pub fn find_vote_by_id(ctx: &ReducerContext, vote_id: u32) -> Option<Vote> {
    ctx.db.vote().id().find(vote_id)
}

/// Find a vote by share token.
pub fn find_vote_by_token(ctx: &ReducerContext, token: &str) -> Option<Vote> {
    ctx.db.vote().by_token().filter(token).next()
}

/// Compute a base64url (no padding) token from stable data and an optional salt.
fn compute_share_token(ctx: &ReducerContext, vote: &Vote, salt: u32) -> String {
    // Combine vote id, timestamp, and a salt to derive a token
    let input = format!("zvote:{}:{:?}:{}", vote.id, ctx.timestamp, salt);
    let hash = blake3::hash(input.as_bytes());
    // Use first 16 bytes -> ~22 char token
    URL_SAFE_NO_PAD.encode(&hash.as_bytes()[..16])
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
pub fn vote_option_vote_id(opt: &VoteOption) -> u32 {
    opt.vote_id
}

/// Get the current approvals_count for a vote option.
pub fn vote_option_approvals_count(opt: &VoteOption) -> u32 {
    opt.approvals_count
}

/// Get all options for a given vote.
pub fn get_vote_options(ctx: &ReducerContext, vote_id: u32) -> impl Iterator<Item = VoteOption> + '_ {
    ctx.db.vote_option().by_vote().filter(vote_id)
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
    fn validate_and_clean_truncates_too_many() {
        let options: Vec<String> = (0..(MAX_OPTIONS as i32 + 5)).map(|i| format!("opt{}", i)).collect();
        let res = validate_and_clean_options(options).unwrap();
        assert_eq!(res.len(), MAX_OPTIONS);
        assert_eq!(res[0], "opt0");
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
