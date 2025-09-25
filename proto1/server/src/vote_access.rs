use spacetimedb::{ReducerContext, Table, Identity, Filter, client_visibility_filter};
use crate::vote::{find_vote_by_token, VISIBILITY_UNLISTED};

// VoteAccess table: tracks which users have access to which unlisted votes
// Public with RLS: clients only see their own access grants
#[spacetimedb::table(
    name = vote_access,
    public,
    index(name = by_vote, btree(columns = [vote_id])),
    index(name = by_user, btree(columns = [user_id])),
    index(name = by_vote_and_user, btree(columns = [vote_id, user_id]))
)]
pub struct VoteAccess {
    #[primary_key]
    #[auto_inc]
    id: u64,
    pub vote_id: u32,
    pub user_id: Identity,
}

// RLS: A user can only see their own access grants
#[client_visibility_filter]
const VOTE_ACCESS_RLS: Filter = Filter::Sql(
    "SELECT vote_access.* FROM vote_access WHERE vote_access.user_id = :sender"
);

// Reducer: grant access to an unlisted vote via token
#[spacetimedb::reducer]
pub fn grant_access_by_token(ctx: &ReducerContext, token: String) -> Result<(), String> {
    // 1. Find the vote by the provided token
    let Some(vote) = find_vote_by_token(ctx, &token) else {
        return Err("Vote not found".into());
    };

    // 2. Only grant access to unlisted votes
    if vote.visibility != VISIBILITY_UNLISTED {
        return Ok(()); // Not an error, just a no-op for public/private votes
    }

    // 3. Don't grant access to the creator, they already have it
    if vote.creator == ctx.sender {
        return Ok(());
    }

    // 4. Check if the user already has access to avoid duplicate entries
    let already_has_access = ctx
        .db
        .vote_access()
        .by_vote_and_user()
        .filter((vote.id, ctx.sender))
        .next()
        .is_some();

    if !already_has_access {
        // 5. Grant access by inserting a new row
        ctx.db.vote_access().insert(VoteAccess {
            id: 0, // auto-incremented
            vote_id: vote.id,
            user_id: ctx.sender,
        });
    }

    Ok(())
}
