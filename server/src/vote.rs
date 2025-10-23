use spacetimedb::{ReducerContext, SpacetimeType, Table, Identity, Timestamp, Filter, client_visibility_filter};
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

// ============================================
// FEATURE FLAGS: Server Capabilities
// ============================================

// Visibility levels
pub const ENABLE_PUBLIC_VOTES: bool = true;
pub const ENABLE_UNLISTED_VOTES: bool = false;
pub const ENABLE_PRIVATE_VOTES: bool = false;

// Voting systems
pub const ENABLE_APPROVAL_VOTING: bool = true;
pub const ENABLE_MAJORITY_JUDGMENT: bool = true;

// Ballot submission modes
pub const ENABLE_LIVE_BALLOT: bool = true;    // Submit changes immediately
pub const ENABLE_ENVELOPE_BALLOT: bool = true; // Batch submit all at once

#[derive(SpacetimeType, Copy, Clone, Debug, PartialEq, Eq)]
pub enum VotingSystem {
    Approval,
    MajorityJudgment,
}

// Visibility levels as integers for RLS-friendly SQL comparisons
// 0 = Public (visible to everyone)
// 1 = Unlisted (visible via token sharing)  
// 2 = Private (visible only to creator)
pub const VISIBILITY_PUBLIC: u8 = 0;
pub const VISIBILITY_UNLISTED: u8 = 1;
pub const VISIBILITY_PRIVATE: u8 = 2;

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
    pub visibility: u8, // 0=Public, 1=Unlisted, 2=Private
    pub created_at: Timestamp,
    pub token: String,
    pub voting_system: VotingSystem,
}



// RLS DEBUGGING: Testing public filter only
#[client_visibility_filter]
const VOTE_RLS_PUBLIC: Filter = Filter::Sql("SELECT * FROM vote WHERE visibility = 0");

#[client_visibility_filter]
const VOTE_RLS_CREATOR: Filter = Filter::Sql("SELECT * FROM vote WHERE creator = :sender");

// #[client_visibility_filter]
// const VOTE_RLS_ACCESS: Filter = Filter::Sql("SELECT vote.* FROM vote JOIN vote_access ON vote.id = vote_access.vote_id WHERE vote_access.user_id = :sender");
// TODO: wait for a fix https://github.com/clockworklabs/SpacetimeDB/issues/2830

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




// RLS DEBUGGING: Testing public filter only
// #[client_visibility_filter]
//const VOTE_OPTION_RLS_PUBLIC: Filter = Filter::Sql("SELECT vote_option.* FROM vote_option JOIN vote ON vote_option.vote_id = vote.id WHERE vote.title = 'public'");

// #[client_visibility_filter]
// const VOTE_OPTION_RLS_CREATOR: Filter = Filter::Sql("SELECT vote_option.* FROM vote_option JOIN vote ON vote_option.vote_id = vote.id WHERE vote.creator = :sender");

// #[client_visibility_filter]
// const VOTE_OPTION_RLS_ACCESS: Filter = Filter::Sql("SELECT vote_option.* FROM vote_option JOIN vote ON vote_option.vote_id = vote.id JOIN vote_access ON vote.id = vote_access.vote_id WHERE vote_access.user_id = :sender");

/// Validate, normalize, deduplicate (case-insensitive), and return the cleaned list of options.
/// - Requires at least 2 options after cleaning
/// - If more than MAX_OPTIONS options remain after cleaning, extras are ignored (truncated)
/// - Uses `normalize_label` to trim/validate each option
/// - Deduplicates options case-insensitively after normalization (preserving first occurrence casing)
pub(crate) fn validate_and_clean_options(options: Vec<String>) -> Result<Vec<String>, String> {
    if options.is_empty() {
        return Err("At least two options are required".into());
    }

    let mut seen_lower = HashSet::<String>::new();
    let mut cleaned: Vec<String> = Vec::with_capacity(options.len());
    for opt in options {
        let o = normalize_label(&opt)?;
        let key = o.to_lowercase();
        if seen_lower.insert(key) {
            cleaned.push(o);
        }
    }
    if cleaned.len() < 2 {
        return Err("At least two unique non-empty options are required".into());
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
    visibility: Option<u8>,
    voting_system: Option<VotingSystem>,
) -> Result<(), String> {
    let title = normalize_label(&title)?;

    let cleaned = validate_and_clean_options(options)?;

    // Resolve visibility (default to Public if enabled, otherwise first available)
    let vis = visibility.unwrap_or(VISIBILITY_PUBLIC);
    
    // Validate that requested visibility is enabled
    match vis {
        VISIBILITY_PUBLIC if !ENABLE_PUBLIC_VOTES => {
            return Err("Public votes are not enabled on this server".to_string());
        }
        VISIBILITY_UNLISTED if !ENABLE_UNLISTED_VOTES => {
            return Err("Unlisted votes are not enabled on this server".to_string());
        }
        VISIBILITY_PRIVATE if !ENABLE_PRIVATE_VOTES => {
            return Err("Private votes are not enabled on this server".to_string());
        }
        _ => {}
    }
    
    // Validate that requested voting system is enabled
    let system = voting_system.unwrap_or(VotingSystem::Approval);
    match system {
        VotingSystem::Approval if !ENABLE_APPROVAL_VOTING => {
            return Err("Approval voting is not enabled on this server".to_string());
        }
        VotingSystem::MajorityJudgment if !ENABLE_MAJORITY_JUDGMENT => {
            return Err("Majority Judgment is not enabled on this server".to_string());
        }
        _ => {}
    }

    // Pre-generate a unique token before inserting the vote
    let temp_vote_for_token = Vote {
        id: 0, // Temp value, will be auto-incremented on insert
        creator: ctx.sender,
        title: title.clone(),
        visibility: vis,
        created_at: ctx.timestamp,
        token: String::new(), // Placeholder
        voting_system: system,
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
        visibility: vis,
        created_at: ctx.timestamp,
        token,
        voting_system: system,
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


// Public server info table so clients can read server capabilities via subscription
#[spacetimedb::table(name = server_info, public)]
pub struct ServerInfo {
    #[primary_key]
    id: u8, // singleton: id = 1
    max_options: u32,
    
    // Visibility levels
    enable_public_votes: bool,
    enable_unlisted_votes: bool,
    enable_private_votes: bool,
    
    // Voting systems
    enable_approval_voting: bool,
    enable_majority_judgment: bool,
    
    // Ballot submission modes
    enable_live_ballot: bool,
    enable_envelope_ballot: bool,
}

/// Ensure the ServerInfo singleton row exists (id=1), seeding server capabilities.
#[spacetimedb::reducer]
pub fn ensure_server_info(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.server_info().id().find(1).is_none() {
        ctx.db.server_info().insert(ServerInfo { 
            id: 1, 
            max_options: MAX_OPTIONS as u32,
            
            // Visibility levels
            enable_public_votes: ENABLE_PUBLIC_VOTES,
            enable_unlisted_votes: ENABLE_UNLISTED_VOTES,
            enable_private_votes: ENABLE_PRIVATE_VOTES,
            
            // Voting systems
            enable_approval_voting: ENABLE_APPROVAL_VOTING,
            enable_majority_judgment: ENABLE_MAJORITY_JUDGMENT,
            
            // Ballot submission modes
            enable_live_ballot: ENABLE_LIVE_BALLOT,
            enable_envelope_ballot: ENABLE_ENVELOPE_BALLOT,
        });
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
    fn validate_and_clean_rejects_only_one() {
        let res = validate_and_clean_options(vec![" OnlyOne ".into()]);
        assert!(res.is_err(), "Should require at least two options");
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
