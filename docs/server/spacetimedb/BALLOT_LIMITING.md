# Ballot Limiting Implementation

This document explains how IP-based and machine-based ballot limiting works in ZVote.

## Overview

Ballot limiting prevents users from submitting multiple ballots to the same vote. There are two types:
- **IP Limiting:** Prevents multiple ballots from the same IP address
- **Machine Limiting:** Prevents multiple ballots from the same device (using client-provided fingerprint)

## Important Notes

**⚠️ Limitations only apply to ANONYMOUS users**
- Authenticated users can vote multiple times (no IP/machine tracking)
- Anonymous users are subject to IP/machine limits when enabled
- Once SpacetimeDB auth bug is fixed, authenticated detection will be improved

**✅ Users can always modify their ballot**
- Changing your vote is always allowed (doesn't create new ballot tracker entry)
- Only first-time ballot submission is tracked
- Withdrawing ballot removes tracker → allows re-voting

## How It Works

### 1. Vote Creation

When creating a vote, the creator can enable limiting:
```rust
create_vote(
    title: "...",
    options: vec!["A", "B", "C"],
    visibility: Some(VISIBILITY_PUBLIC),
    voting_system: Some(VotingSystem::Approval),
    limit_by_ip: Some(true),      // Enable IP limiting
    limit_by_machine: Some(false), // Disable machine limiting
)
```

### 2. Ballot Tracking Table

The `ballot_tracker` table records each ballot submission:
```rust
pub struct BallotTracker {
    id: u32,
    vote_id: u32,
    user_identity: Identity,      // SpacetimeDB user identity
    user_address: String,          // IP-like connection address
    device_fingerprint: String,    // Client-provided device fingerprint
    submitted_at: Timestamp,
}
```

### 3. Ballot Submission Flow

**For Approval Voting (`set_approvals`):**
1. **Check if authenticated:** If user is authenticated → skip all limiting checks
2. Check if user has any existing approvals for this vote
3. If first-time ballot AND vote has limiting enabled AND user is anonymous:
   - Check `ballot_tracker` for existing ballots from same IP/machine
   - If found → reject with error message
   - If not found → allow ballot
4. Process ballot normally (add/remove approvals as needed)
5. **Update ballot tracker:**
   - If first-time ballot with options → record in `ballot_tracker`
   - If withdrawing entire ballot (empty desired set) → remove from `ballot_tracker`
   - If modifying existing ballot → no tracker changes

**For Majority Judgment (`cast_judgment`):**
1. **Check if authenticated:** If user is authenticated → skip all limiting checks
2. Check if user has any existing judgments for this vote
3. If first-time ballot AND vote has limiting enabled AND user is anonymous:
   - Check `ballot_tracker` for existing ballots from same IP/machine
   - If found → reject with error message
   - If not found → allow ballot
4. Process ballot normally (default all options to "Bad", then apply judgment)
5. If first-time ballot → record in `ballot_tracker`

**For Withdrawing Ballot:**
- **Approval:** Call `set_approvals` with empty array
- **Majority Judgment:** Call `withdraw_judgments` reducer
- **Both cases:** Remove from `ballot_tracker` → allows re-voting

### 4. IP Address Detection

SpacetimeDB provides `ctx.address` which represents the connection source:
```rust
let user_address = format!("{:?}", ctx.address);
```

This gives us an IP-like identifier that's consistent for the same connection source.

### 5. Anonymous vs Authenticated Users

**Current Implementation:**
```rust
pub(crate) fn is_anonymous_user(_ctx: &ReducerContext) -> bool {
    // For now, we assume all users are anonymous
    // TODO: Improve once SpacetimeDB auth bug is fixed
    true
}
```

**Future Implementation (once auth works):**
- Check if user Identity matches authenticated pattern
- Maintain table of authenticated user sessions
- Derive Identity from JWT claims (issuer + subject)
- Authenticated users bypass all IP/machine limits

**Why skip limits for authenticated users?**
- They're already identified (no need for IP tracking)
- Prevents blocking legitimate multi-device usage
- Focuses security on anonymous ballot stuffing

### 6. Device Fingerprinting

Currently not implemented on the client side. The infrastructure is ready:
- Server accepts `device_fingerprint` parameter
- `ballot_tracker` table stores it
- Future: Client can generate fingerprint (browser-based, canvas fingerprinting, etc.)

## Security Considerations

### Limitations

**This is NOT foolproof:**
- ❌ VPNs bypass IP limiting
- ❌ NAT/proxies may block legitimate users behind same IP
- ❌ Browser fingerprinting can be spoofed
- ❌ Incognito/private mode may bypass machine limiting

**This IS effective against:**
- ✅ Casual duplicate voting by regular users
- ✅ Accidental double-submissions
- ✅ Basic ballot stuffing attempts

### Design Philosophy

> "I know it will be easy to workaround for hackers, I just want it to be difficult for regular humans." - User requirement

This implementation achieves exactly that:
- Simple enough to work reliably
- Uses built-in SpacetimeDB features (ctx.address)
- Provides clear error messages
- Doesn't block legitimate use cases (vote changes allowed)

## Current Configuration

By default, both features are **disabled**:
```rust
pub const ENABLE_IP_LIMITING: bool = false;
pub const ENABLE_MACHINE_LIMITING: bool = false;
```

To enable:
1. Set flags to `true` in `server/src/vote.rs`
2. Rebuild server with `./go.sh`
3. UI will automatically show security options in create vote form

## Error Messages

Users will see clear messages when blocked:
- `"You have already submitted a ballot from this IP address for this vote"`
- `"You have already submitted a ballot from this device for this vote"`

## Future Enhancements

1. **Client-side fingerprinting:**
   - Generate device fingerprint in browser
   - Pass to reducers via new parameter
   - Enable machine limiting

2. **Admin override:**
   - Allow vote creators to clear ballot tracker entries
   - Useful for testing or legitimate resets

3. **Time-based limits:**
   - Allow one ballot per IP per day
   - Reset limitations after certain period

4. **Analytics:**
   - Show vote creator how many IPs voted
   - Detect suspicious patterns

## Testing

### Testing IP Limiting (Anonymous Users)

1. Enable `ENABLE_IP_LIMITING = true`
2. Create a vote with "Limit 1 ballot per IP" checked
3. **First ballot:** Submit → ✅ works
4. **Modify ballot:** Change selections → ✅ works (same ballot, not new submission)
5. **Withdraw ballot:** Remove all selections → ✅ works, removes from tracker
6. **Re-vote:** Submit new ballot → ✅ works (tracker was cleared)
7. **Different identity, same IP:** Try from new anonymous identity → ❌ blocked

### Testing With Authenticated Users (Future)

1. Enable IP limiting
2. Create vote with "Limit 1 ballot per IP" checked
3. **Authenticated user:** Submit ballot → ✅ works
4. **Same user, different device:** Vote again → ✅ works (authenticated users not limited)
5. **Anonymous user, same IP:** Try to vote → ❌ blocked (if they voted first)

### Behavior Summary

| Scenario | IP Limiting ON | IP Limiting OFF |
|----------|---------------|-----------------|
| Anonymous - First vote | ✅ Allowed | ✅ Allowed |
| Anonymous - Modify vote | ✅ Allowed | ✅ Allowed |
| Anonymous - Withdraw & re-vote | ✅ Allowed | ✅ Allowed |
| Anonymous - New identity, same IP | ❌ Blocked | ✅ Allowed |
| Authenticated - Any scenario | ✅ Always allowed | ✅ Allowed |

## Code Locations

- **Server flags:** `server/src/vote.rs` lines 33-34
- **BallotTracker table:** `server/src/vote.rs` lines 89-105
- **Helper functions:** `server/src/vote.rs` lines 168-222
- **Approval integration:** `server/src/approval.rs` lines 131-141, 200-203
- **Judgment integration:** `server/src/judgment.rs` lines 157-181
- **Client UI:** `client/src/components/CreateVoteForm.tsx` lines 316-353
