// Minimal crate root: declare modules and re-export public API

pub mod utils;
pub mod vote;
pub mod approval;
pub mod judgment;

// Re-export types and reducers to preserve the public API surface.
pub use approval::{Approval, approve, unapprove, set_approvals};
pub use judgment::{Mention, Judgment, cast_judgment};
pub use vote::{
    Vote,
    VoteOption,
    ServerInfo,
    create_vote,
    delete_vote,
    ensure_server_info,
    MAX_OPTIONS,
};
