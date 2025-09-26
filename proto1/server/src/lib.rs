#![allow(unused_imports)]

pub mod utils;
pub mod vote;
pub mod approval;
pub mod judgment;
pub mod vote_access;

pub use approval::{
    Approval, 
    // Original names
    approve, unapprove, set_approvals,
    // Clear ballot terminology aliases
    submit_approval_ballot, withdraw_approval_ballot, set_approval_ballot
};
pub use judgment::{
    Mention, Judgment, 
    // Original name
    cast_judgment,
    // Clear ballot terminology alias
    submit_judgment_ballot
};
pub use vote_access::{VoteAccess, grant_access_by_token};
pub use vote::{
    Vote,
    VoteOption,
    ServerInfo,
    create_vote,
    delete_vote,
    ensure_server_info,
    MAX_OPTIONS,
};
