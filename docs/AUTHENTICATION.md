# OpenID Connect Authentication in ZVote

This document explains how to set up and use OpenID Connect (OIDC) authentication in ZVote with SpacetimeDB.

## Overview

ZVote now supports multiple authentication methods:
- **Google** - OAuth 2.0 / OIDC
- **Apple** - Sign in with Apple
- **Meta (Facebook)** - Facebook Login
- **Email** - Passwordless email authentication
- **Anonymous** - SpacetimeDB's default random identity

## Architecture

### Client-Side Components

1. **`identityDerivation.ts`** - Implements SpacetimeDB's identity derivation algorithm
   - Derives 32-byte Identity from JWT `iss` (issuer) and `sub` (subject) claims
   - Uses SHA-256 hash (can be upgraded to BLAKE3 for exact SpacetimeDB compatibility)

2. **`authService.ts`** - Manages authentication flows
   - OAuth 2.0 / OIDC provider integration
   - JWT token acquisition and storage
   - Session management
   - Auth state change notifications

3. **`AuthLogin.tsx`** - Authentication UI component
   - Login buttons for all providers
   - Token input for development/testing
   - Anonymous login option

4. **`spacetimeClient.ts`** - SpacetimeDB integration
   - Automatically uses OIDC tokens when available
   - Falls back to anonymous identity if not authenticated

### Server-Side (Optional)

For production deployments, you should add JWT validation on the server:

1. Add `jsonwebtoken` crate to `server/Cargo.toml`
2. Create validation middleware in reducers
3. Verify JWT signatures using provider's public keys

## Setup Instructions

### 1. Install Dependencies

```bash
cd client
npm install
```

Dependencies added:
- `jose` - JWT encoding/decoding and validation

### 2. Configure OAuth Providers

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5173/auth/callback`, `https://yourdomain.com/auth/callback`
5. Copy Client ID
6. Add to `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here
   ```

#### Apple Sign In

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create an App ID with "Sign In with Apple" capability
3. Create a Services ID
4. Configure Sign In with Apple:
   - Return URLs: `http://localhost:5173/auth/callback`, `https://yourdomain.com/auth/callback`
5. Add to `.env`:
   ```
   VITE_APPLE_CLIENT_ID=your-service-id-here
   ```

#### Meta (Facebook)

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs: `http://localhost:5173/auth/callback`
5. Copy App ID
6. Add to `.env`:
   ```
   VITE_META_CLIENT_ID=your-app-id-here
   ```

#### Email Authentication

For email-based auth, you need a backend service. Options:

1. **Auth0** - Full authentication service
2. **Supabase** - Open-source backend with auth
3. **Custom Backend** - Implement passwordless email flow

Example with Auth0:
```
VITE_EMAIL_CLIENT_ID=your-auth0-client-id
VITE_EMAIL_AUTH_ENDPOINT=https://your-domain.auth0.com/authorize
VITE_EMAIL_TOKEN_ENDPOINT=https://your-domain.auth0.com/oauth/token
```

### 3. Implement Token Exchange Backend (Required)

The OAuth authorization code flow requires a backend to exchange the code for tokens:

```typescript
// Example backend endpoint (Express.js)
app.post('/auth/token-exchange', async (req, res) => {
  const { code, provider } = req.body;
  
  // Exchange code for access token with provider
  const tokenResponse = await fetch(PROVIDER_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  
  const tokens = await tokenResponse.json();
  
  // Return JWT token to client
  res.json({ token: tokens.id_token });
});
```

### 4. OAuth Callback Route

Create a callback route in your React app to handle OAuth redirects:

```typescript
// In your router setup
<Route path="/auth/callback" element={<AuthCallback />} />

// AuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../lib/authService';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code && state) {
      // Exchange code for token via your backend
      fetch('/api/auth/token-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })
        .then(res => res.json())
        .then(({ token }) => authService.loginWithToken(token))
        .then(() => navigate('/'))
        .catch(err => {
          console.error('Auth failed:', err);
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);
  
  return <div>Completing authentication...</div>;
}
```

## Usage

### For Users

1. Click the menu button (☰) in the header
2. Click "🔐 Login with Provider"
3. Choose your preferred login method:
   - **Google, Apple, Meta** - Redirects to provider's login page
   - **Email** - Sends magic link to your email
   - **Anonymous** - Continue without authentication (default)
4. After successful login, your identity is derived from JWT claims
5. All votes and ballots are associated with your authenticated identity

### For Developers

#### Testing with JWT Token

1. Open the login modal
2. Click "🔧 Developer: Login with JWT"
3. Paste a valid JWT token
4. The identity will be derived from `iss` and `sub` claims

#### Generate Test JWT

You can use [jwt.io](https://jwt.io/) to create test tokens:

```json
{
  "iss": "https://test-issuer.example.com",
  "sub": "user-12345",
  "email": "test@example.com",
  "name": "Test User",
  "exp": 1735689600
}
```

## How Identity Derivation Works

SpacetimeDB uses a deterministic algorithm to derive user Identity:

1. **Extract Claims**: Get `iss` (issuer) and `sub` (subject) from JWT
2. **Concatenate**: Combine with null byte: `issuer + "\0" + subject`
3. **Hash**: Hash using BLAKE3 (or SHA-256) → 32 bytes
4. **Identity**: This 32-byte value is the user's unique Identity

This ensures:
- Same user from same provider always gets same Identity
- Different providers can't collide (different issuers)
- User identity is portable across sessions

## Security Considerations

### Client-Side Security

✅ **State Parameter** - CSRF protection in OAuth flows
✅ **Token Storage** - JWT stored in localStorage and secure cookies
✅ **Token Validation** - Format and claim validation before use
❌ **No Signature Verification** - Client cannot verify JWT signatures securely

### Server-Side Security (Recommended for Production)

For production deployments, implement server-side JWT validation:

```rust
// In your SpacetimeDB reducer
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};

#[spacetimedb::reducer]
pub fn authenticated_action(ctx: &ReducerContext, token: String) -> Result<(), String> {
    // 1. Decode and verify JWT
    let decoding_key = DecodingKey::from_rsa_pem(GOOGLE_PUBLIC_KEY)?;
    let validation = Validation::new(Algorithm::RS256);
    let token_data = decode::<Claims>(&token, &decoding_key, &validation)
        .map_err(|e| format!("Invalid token: {}", e))?;
    
    // 2. Derive expected Identity from claims
    let expected_identity = derive_identity(
        &token_data.claims.iss,
        &token_data.claims.sub
    );
    
    // 3. Verify caller matches derived identity
    if ctx.sender != expected_identity {
        return Err("Identity mismatch".into());
    }
    
    // 4. Proceed with authenticated action
    Ok(())
}
```

### Privacy

- JWT tokens contain personal information (email, name)
- Store tokens securely
- Don't log or expose tokens
- Implement proper token expiration and refresh

## Troubleshooting

### "Authentication not configured"

**Cause**: OAuth client IDs not set in environment variables

**Solution**: Create `.env` file with your provider credentials:
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_APPLE_CLIENT_ID=your-service-id
VITE_META_CLIENT_ID=your-app-id
```

### "OAuth callback handling requires backend implementation"

**Cause**: Trying to complete OAuth flow without backend token exchange

**Solution**: Implement backend endpoint to exchange authorization codes for tokens (see Setup Instructions #3)

### "Invalid authentication token"

**Cause**: JWT format is invalid or missing required claims

**Solution**: Verify JWT has `iss` and `sub` claims using [jwt.io](https://jwt.io/)

### Identity Mismatch

**Cause**: Derived identity doesn't match SpacetimeDB's derivation

**Solution**: 
1. Ensure using same hash algorithm (BLAKE3 or SHA-256)
2. Verify null byte separator between issuer and subject
3. Check that issuer and subject values match exactly

## Development vs Production

### Development

- Use "Developer: Login with JWT" option
- Generate test tokens with [jwt.io](https://jwt.io/)
- No backend required
- No signature verification

### Production

✅ Implement token exchange backend
✅ Verify JWT signatures
✅ Use HTTPS for all OAuth redirects
✅ Store client secrets securely (never in client code)
✅ Implement token refresh
✅ Add rate limiting
✅ Monitor authentication errors

## Additional Resources

- [SpacetimeDB Authentication Docs](https://spacetimedb.com/docs)
- [OpenID Connect Specification](https://openid.net/connect/)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Meta Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [JWT.io - JWT Debugger](https://jwt.io/)

## Example: Complete Flow

1. User clicks "Continue with Google"
2. Browser redirects to Google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=...`
3. User signs in with Google
4. Google redirects back: `http://localhost:5173/auth/callback?code=xyz&state=abc`
5. Callback route sends code to your backend
6. Backend exchanges code for tokens with Google
7. Backend returns JWT `id_token` to client
8. Client extracts `iss` and `sub` from JWT
9. Client derives SpacetimeDB Identity
10. Client connects to SpacetimeDB with JWT token
11. User is authenticated and can vote!
