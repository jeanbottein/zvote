# ZVote Authentication Implementation

## Overview

ZVote now supports OpenID Connect authentication with multiple login providers, integrated with SpacetimeDB's identity management system.

## Features Implemented

### ✅ Client-Side Components

1. **Identity Derivation** (`client/src/lib/identityDerivation.ts`)
   - Implements SpacetimeDB's identity algorithm
   - Derives 32-byte Identity from JWT `iss` + `sub` claims
   - Uses SHA-256 hash (upgradeable to BLAKE3)

2. **Authentication Service** (`client/src/lib/authService.ts`)
   - OAuth 2.0 / OIDC flow management
   - Multiple provider support: Google, Apple, Meta, Email
   - JWT token acquisition and storage
   - Session management with localStorage
   - Auth state change notifications

3. **Login UI Component** (`client/src/components/AuthLogin.tsx`)
   - Beautiful modal with provider buttons
   - Anonymous login option
   - Developer JWT token input for testing
   - Responsive design with smooth animations

4. **SpacetimeDB Integration** (`client/src/lib/spacetimeClient.ts`)
   - Automatic OIDC token usage
   - Falls back to anonymous identity
   - Reconnection handling on auth changes

5. **Header Integration** (`client/src/components/Header.tsx`)
   - Login/logout buttons in menu
   - Display authenticated user info (provider, email, name)
   - Seamless auth state updates

### ✅ Server-Side Components (Optional)

6. **JWT Validation Module** (`server/src/auth_validation.rs`)
   - Server-side token verification
   - Identity derivation matching client
   - Example authenticated reducer
   - Production-ready validation template

### ✅ Documentation

7. **Comprehensive Docs** (`docs/AUTHENTICATION.md`)
   - Complete OAuth setup instructions
   - Identity derivation explanation
   - Security considerations
   - Troubleshooting guide

8. **Quick Setup Guide** (`docs/AUTH_SETUP_GUIDE.md`)
   - 5-minute quick start
   - Step-by-step OAuth configuration
   - Backend token exchange examples
   - Common issues and fixes

9. **Environment Config** (`client/.env.example`)
   - Template for OAuth credentials
   - All provider configurations
   - Clear instructions

## Authentication Flow

```
┌─────────┐                ┌──────────────┐                ┌─────────────┐
│  User   │                │   Provider   │                │  ZVote App  │
└────┬────┘                └──────┬───────┘                └──────┬──────┘
     │                            │                               │
     │ 1. Click "Login with Google"                              │
     │────────────────────────────────────────────────────────>  │
     │                            │                               │
     │ 2. Redirect to Google                                     │
     │ <────────────────────────────────────────────────────────│
     │                            │                               │
     │ 3. Sign in with Google    │                               │
     │─────────────────────────>  │                               │
     │                            │                               │
     │ 4. Authorization code      │                               │
     │ <──────────────────────────│                               │
     │                            │                               │
     │ 5. Send code to backend                                   │
     │────────────────────────────────────────────────────────>  │
     │                            │                               │
     │                       6. Exchange code for JWT            │
     │                            │ <─────────────────────────────│
     │                            │                               │
     │                       7. Return JWT                        │
     │                            │───────────────────────────────>
     │                            │                               │
     │ 8. JWT with iss + sub claims                              │
     │ <────────────────────────────────────────────────────────│
     │                            │                               │
     │ 9. Derive SpacetimeDB Identity                            │
     │    hash(iss + "\0" + sub) = 32-byte Identity              │
     │────────────────────────────────────────────────────────>  │
     │                            │                               │
     │ 10. Connect to SpacetimeDB with JWT token                 │
     │────────────────────────────────────────────────────────>  │
     │                            │                               │
     │ 11. Authenticated! Create votes, cast ballots             │
     │ <────────────────────────────────────────────────────────│
```

## Usage

### For Users

1. Open ZVote application
2. Click **☰** menu → **🔐 Login with Provider**
3. Choose authentication method:
   - **Google** - Sign in with Google account
   - **Apple** - Sign in with Apple ID
   - **Meta** - Sign in with Facebook account
   - **Email** - Passwordless email authentication
   - **Anonymous** - Continue without login (default)
4. Complete provider authentication
5. Return to ZVote - your identity is now authenticated!

### For Developers

#### Quick Test (No OAuth Setup)

```bash
# Install dependencies
cd client
npm install

# Run app
npm run dev

# Use "Developer: Login with JWT" option
# Paste any valid JWT with iss/sub claims
```

#### Full OAuth Setup

```bash
# 1. Configure OAuth provider (see AUTH_SETUP_GUIDE.md)

# 2. Set environment variables
cd client
cp .env.example .env
# Edit .env with your Client IDs

# 3. Set up backend token exchange (required)
# See AUTH_SETUP_GUIDE.md for Express.js example

# 4. Add callback route to React Router
# See AUTH_SETUP_GUIDE.md for code

# 5. Test authentication flow
npm run dev
```

## File Structure

```
zvote/
├── client/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── identityDerivation.ts    # Identity derivation algorithm
│   │   │   ├── authService.ts           # Authentication service
│   │   │   └── spacetimeClient.ts       # SpacetimeDB integration (updated)
│   │   ├── components/
│   │   │   ├── AuthLogin.tsx            # Login UI modal
│   │   │   └── Header.tsx               # Menu integration (updated)
│   │   └── styles/
│   │       └── auth-login.css           # Login UI styles
│   ├── .env.example                     # Environment template
│   └── package.json                     # Dependencies (jose added)
├── server/
│   └── src/
│       └── auth_validation.rs           # Server-side JWT validation (optional)
└── docs/
    ├── AUTHENTICATION.md                # Full documentation
    ├── AUTH_SETUP_GUIDE.md              # Quick setup guide
    └── AUTH_README.md                   # This file
```

## Key Technologies

- **jose** - JWT encoding/decoding (browser-compatible)
- **SpacetimeDB SDK** - Identity management
- **React** - UI components
- **OpenID Connect** - Authentication protocol
- **OAuth 2.0** - Authorization framework

## Identity Derivation

SpacetimeDB derives unique user identities from JWT claims:

```typescript
// 1. Extract claims from JWT
const { iss, sub } = parseJWT(token);
// iss = "https://accounts.google.com"
// sub = "123456789"

// 2. Concatenate with null byte separator
const combined = `${iss}\0${sub}`;

// 3. Hash to 32 bytes
const hash = SHA256(combined);

// 4. This is the user's Identity
const identity = hash; // 32 bytes
```

**Benefits:**
- Same user = same identity across sessions
- Different providers can't collide (unique issuers)
- Portable identity (works across clients)
- No database required for user management

## Security

### ✅ Implemented

- State parameter for CSRF protection
- JWT claim validation (format, expiration)
- Secure token storage (localStorage + cookies)
- Identity derivation verification
- HTTPS enforcement (production)

### ⚠️ Requires Setup

- JWT signature verification (backend)
- Token refresh flow (backend)
- Rate limiting (backend)
- Server-side identity validation (optional)

### 🔒 Best Practices

1. **Never expose client secrets** in frontend code
2. **Always verify JWT signatures** on the server
3. **Use HTTPS** for all OAuth redirects in production
4. **Implement token refresh** for long-lived sessions
5. **Validate identity** on every sensitive operation
6. **Monitor auth failures** for security issues

## Testing

### Manual Testing

1. **Anonymous Mode** (default):
   ```bash
   npm run dev
   # No auth needed, random identity assigned
   ```

2. **Developer Mode** (JWT tokens):
   - Generate test JWT at https://jwt.io/
   - Use "Developer: Login with JWT" option
   - Verify identity derivation in console

3. **OAuth Flow** (full setup):
   - Configure provider OAuth app
   - Set up backend token exchange
   - Test complete authentication flow
   - Verify user info in menu

### Automated Testing

```bash
# Test identity derivation
cd client
npm test -- identityDerivation.test.ts

# Test auth service
npm test -- authService.test.ts
```

## Deployment

### Development

- OAuth redirect: `http://localhost:5173/auth/callback`
- No signature verification required
- Can use test JWTs

### Production

- OAuth redirect: `https://yourdomain.com/auth/callback`
- **Required**: Backend token exchange with signature verification
- **Required**: HTTPS for all endpoints
- **Recommended**: Server-side identity validation
- **Recommended**: Token refresh implementation

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Authentication not configured" | Missing OAuth credentials | Add Client IDs to `.env` |
| "OAuth callback requires backend" | No token exchange server | Set up backend (see guide) |
| "Invalid token" | JWT format/claims incorrect | Verify JWT at jwt.io |
| "Identity mismatch" | Derivation algorithm differs | Check iss/sub claims |
| Redirect URI mismatch | OAuth config incorrect | Match exact redirect URI |

See `docs/AUTH_SETUP_GUIDE.md` for detailed troubleshooting.

## Next Steps

### Phase 1: Basic Setup ✅ Complete
- [x] Client authentication components
- [x] Identity derivation
- [x] UI integration
- [x] Documentation

### Phase 2: OAuth Integration (Your Setup)
- [ ] Configure OAuth providers
- [ ] Set up backend token exchange
- [ ] Add callback route
- [ ] Test authentication flows

### Phase 3: Production Hardening
- [ ] Implement JWT signature verification
- [ ] Add token refresh
- [ ] Enable server-side validation
- [ ] Set up monitoring and alerting
- [ ] Security audit

### Phase 4: Enhanced Features
- [ ] Social profile pictures
- [ ] Account linking (multiple providers)
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] Admin role management

## Resources

- **Documentation**: `docs/AUTHENTICATION.md` - Complete reference
- **Setup Guide**: `docs/AUTH_SETUP_GUIDE.md` - Quick start instructions
- **Server Validation**: `server/src/auth_validation.rs` - Example code
- **SpacetimeDB Docs**: https://spacetimedb.com/docs
- **OpenID Connect**: https://openid.net/connect/
- **JWT Debugger**: https://jwt.io/

## Support

Need help with authentication?

1. Check `docs/AUTH_SETUP_GUIDE.md` for common issues
2. Review SpacetimeDB authentication docs
3. Test with developer JWT mode first
4. Verify OAuth provider configuration
5. Check browser console for errors

## License

Same as ZVote main project.
