# IP Limiting Status - NOT IMPLEMENTED

## Current Status: ❌ NOT IMPLEMENTED

IP-based ballot limiting is **not currently implementable** due to SpacetimeDB limitations.

## Why It Doesn't Work

SpacetimeDB's `ReducerContext` does not expose client IP addresses or any network information that could be used to identify the source of a request.

**Available fields:**
```rust
pub struct ReducerContext {
    pub sender: Identity,              // User's identity (can create multiple)
    pub timestamp: Timestamp,          // When reducer was called
    pub connection_id: Option<ConnectionId>, // Connection ID (not IP, changes per tab/reconnect)
    pub db: Local,                     // Database access
}
```

**What we need but don't have:**
- Client IP address
- Real network identifier that persists across tabs/windows

## Current Implementation

### Server Side:
1. **Feature Flag:** `ENABLE_IP_LIMITING = false` with documentation
2. **Parameter:** `create_vote()` accepts `limit_by_ip: Option<bool>`
3. **Validation:** Returns error if user tries to create vote with `limit_by_ip: true`
4. **ServerInfo:** Exposes `enable_ip_limiting: false` to clients

### Client Side:
1. **Form UI:** Checkbox for "Limit 1 ballot per IP address"
2. **Capability Check:** Only shows checkbox if server supports it (currently hidden)
3. **Hook Parameter:** `limitByIp` parameter in `useCreateVote`

## Current Behavior

**When user tries to create vote with IP limiting:**
```
Error: "IP-based ballot limiting is not implemented yet (SpacetimeDB does not expose client IP addresses)"
```

**Normal flow:**
1. Server advertises `enable_ip_limiting: false` via ServerInfo
2. Client reads this and **hides the checkbox**
3. Users cannot enable the feature
4. No votes created with IP limiting

## What We Removed

To keep things simple, we removed:
- ❌ BallotTracker table (was empty placeholder)
- ❌ Helper functions (`check_ballot_allowed`, `record_ballot_submission`, `remove_ballot_tracking`)
- ❌ All ballot tracking logic in approval.rs and judgment.rs
- ❌ Anonymous user detection (not needed without enforcement)

## What We Kept

✅ Feature flag with clear documentation
✅ Parameter in create_vote reducer (optional, rejected if true)
✅ ServerInfo capability exposure
✅ Client UI infrastructure (respects server capability)
✅ Clear error message explaining why it doesn't work

## Future Implementation

If/when SpacetimeDB adds IP access to `ReducerContext`, we would need to:

1. **Update ReducerContext (SpacetimeDB side):**
   ```rust
   pub struct ReducerContext {
       // ... existing fields ...
       pub client_address: Option<IpAddr>,  // NEW: Client's IP
   }
   ```

2. **Add back BallotTracker table:**
   ```rust
   #[spacetimedb::table(name = ballot_tracker, public, ...)]
   pub struct BallotTracker {
       pub id: u32,
       pub vote_id: u32,
       pub user_identity: Identity,
       pub user_address: String,  // IP address
       pub submitted_at: Timestamp,
   }
   ```

3. **Implement checking logic:**
   ```rust
   pub(crate) fn check_ballot_allowed(ctx: &ReducerContext, vote: &Vote) -> Result<(), String> {
       if !vote.limit_by_ip { return Ok(()); }
       
       let ip = ctx.client_address.unwrap().to_string();
       let existing = ctx.db.ballot_tracker()
           .by_vote_and_address()
           .filter((vote.id, ip))
           .next();
       
       if existing.is_some() {
           return Err("Already voted from this IP".into());
       }
       Ok(())
   }
   ```

4. **Remove error in create_vote:**
   ```rust
   if use_ip_limit && !ENABLE_IP_LIMITING {
       return Err("IP limiting not enabled".into());
   }
   // Instead of: if use_ip_limit { return Err(...); }
   ```

5. **Enable flag:**
   ```rust
   pub const ENABLE_IP_LIMITING: bool = true;
   ```

## Decision Rationale

**Why this approach:**
- ✅ Clean and simple
- ✅ No dead code or empty tables
- ✅ Clear error message to users
- ✅ Infrastructure minimal but present
- ✅ Easy to add back when needed

**Why not keep placeholders:**
- Empty BallotTracker table serves no purpose
- Helper functions that do nothing add confusion
- Better to have clear "not implemented" than fake implementation

## Related Files

### Server:
- `server/src/vote.rs` - Feature flag, create_vote validation, ServerInfo
- `server/src/approval.rs` - Clean (no IP limiting references)
- `server/src/judgment.rs` - Clean (no IP limiting references)

### Client:
- `client/src/components/CreateVoteForm.tsx` - IP limiting checkbox (hidden when not supported)
- `client/src/hooks/useCreateVote.ts` - Passes limitByIp parameter

## Testing

To verify it works correctly:

1. **Check server capability:**
   - ServerInfo should show `enable_ip_limiting: false`
   
2. **UI should be hidden:**
   - Create vote form should NOT show IP limiting checkbox
   
3. **If someone bypasses client validation:**
   ```
   Error: "IP-based ballot limiting is not implemented yet 
          (SpacetimeDB does not expose client IP addresses)"
   ```

## Summary

IP limiting is **cleanly rejected** at vote creation time with a clear explanation. No placeholder code, no empty tables, just a simple validation that returns an error if someone tries to use an unimplemented feature.

**Status:** ⛔ BLOCKED - awaiting SpacetimeDB enhancement
