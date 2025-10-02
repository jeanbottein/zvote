# Quick Authentication Setup Guide

## TL;DR - Get Started in 5 Minutes

### Option 1: Anonymous Mode (Default - No Setup Required)

ZVote works out of the box with anonymous authentication:

```bash
cd client
npm install
npm run dev
```

Users get random SpacetimeDB identities. No OAuth configuration needed.

### Option 2: Developer Mode (JWT Token Testing)

Test authentication with custom JWT tokens:

1. Generate a test JWT at [jwt.io](https://jwt.io/)
2. Include required claims:
   ```json
   {
     "iss": "https://test.example.com",
     "sub": "test-user-123",
     "email": "test@example.com",
     "exp": 9999999999
   }
   ```
3. In ZVote: Menu → "🔐 Login with Provider" → "🔧 Developer: Login with JWT"
4. Paste your token

### Option 3: Production OAuth (Full Setup)

For real Google/Apple/Meta authentication:

#### Step 1: Install Dependencies

```bash
cd client
npm install  # jose is already in package.json
```

#### Step 2: Configure OAuth Provider

Choose one provider to start:

**Google (Easiest):**
1. Go to https://console.cloud.google.com/
2. Create project → Enable Google+ API
3. Create OAuth 2.0 Client ID (Web application)
4. Add redirect URI: `http://localhost:5173/auth/callback`
5. Copy Client ID

**Apple:**
1. Go to https://developer.apple.com/
2. Create Services ID
3. Configure Sign In with Apple
4. Add return URL: `http://localhost:5173/auth/callback`

**Meta:**
1. Go to https://developers.facebook.com/
2. Create app → Add Facebook Login
3. Add redirect URI: `http://localhost:5173/auth/callback`

#### Step 3: Configure Environment

```bash
cd client
cp .env.example .env
```

Edit `.env`:
```bash
# Add your Client ID
VITE_GOOGLE_CLIENT_ID=your-actual-client-id-here
```

#### Step 4: Create Backend Token Exchange

**Important**: OAuth requires a backend to securely exchange authorization codes for tokens.

Simple Express.js example:

```javascript
// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

app.post('/api/auth/token-exchange', async (req, res) => {
  const { code, provider } = req.body;
  
  // Provider endpoints
  const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
  
  try {
    const response = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: 'http://localhost:5173/auth/callback',
        grant_type: 'authorization_code',
      }),
    });
    
    const tokens = await response.json();
    res.json({ token: tokens.id_token });
  } catch (error) {
    console.error('Token exchange failed:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(3001, () => console.log('Auth server on :3001'));
```

Run it:
```bash
npm install express node-fetch
node server.js
```

#### Step 5: Add OAuth Callback Route

Create `client/src/pages/AuthCallback.tsx`:

```tsx
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
      fetch('http://localhost:3001/api/auth/token-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, provider: 'google' }),
      })
        .then(res => res.json())
        .then(({ token }) => authService.loginWithToken(token))
        .then(() => navigate('/'))
        .catch(err => {
          console.error('Auth failed:', err);
          alert('Authentication failed. Please try again.');
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);
  
  return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <h2>Completing authentication...</h2>
      <p>Please wait while we sign you in.</p>
    </div>
  );
}
```

Add route to your router:
```tsx
import AuthCallback from './pages/AuthCallback';

// In your routes:
<Route path="/auth/callback" element={<AuthCallback />} />
```

#### Step 6: Test Authentication

1. Start SpacetimeDB: `cd proto1 && ./start.sh`
2. Start backend: `node server.js` (port 3001)
3. Start client: `cd client && npm run dev` (port 5173)
4. Open http://localhost:5173
5. Click Menu → "🔐 Login with Provider"
6. Choose "Continue with Google"
7. Sign in with your Google account
8. You should be redirected back and authenticated!

## Verification

After authentication, check:

1. **Menu shows your info**:
   - Provider: google
   - Email: your@email.com

2. **Console shows derived identity**:
   ```
   Connected to SpacetimeDB! { identity: "abc123...", token: "eyJ..." }
   ```

3. **Votes are associated with your identity**:
   - Create a vote
   - Check server logs for authenticated user

## Troubleshooting

### "Authentication not configured"

**Problem**: `.env` file missing or Client ID not set

**Fix**: 
```bash
cd client
cp .env.example .env
# Edit .env and add your VITE_GOOGLE_CLIENT_ID
```

### "OAuth callback handling requires backend implementation"

**Problem**: No backend to exchange authorization code

**Fix**: Set up the Express.js backend from Step 4

### Redirect URI Mismatch

**Problem**: OAuth provider rejects redirect URI

**Fix**: Make sure OAuth console has exact URL:
- Development: `http://localhost:5173/auth/callback`
- Production: `https://yourdomain.com/auth/callback`

### Token Exchange Fails

**Problem**: Backend can't get tokens from provider

**Check**:
1. Client Secret is correct
2. Authorization code hasn't expired (use immediately)
3. Redirect URI matches exactly
4. Check backend logs for error details

## Security Notes

### Development

- ⚠️ Client secrets in code (local only)
- ⚠️ No signature verification
- ⚠️ HTTP allowed for localhost

### Production Checklist

- [ ] Client secrets stored securely (environment variables on server)
- [ ] HTTPS enforced for all OAuth redirects
- [ ] JWT signature verification enabled
- [ ] Token refresh implemented
- [ ] Rate limiting on auth endpoints
- [ ] Error monitoring and alerting
- [ ] SpacetimeDB server-side validation (optional but recommended)

## Next Steps

1. **Multiple Providers**: Add Apple, Meta after Google works
2. **Server Validation**: Implement Rust JWT validation (see `auth_validation.rs`)
3. **Token Refresh**: Handle token expiration gracefully
4. **Error Handling**: Better error messages for users
5. **Session Management**: Remember user across page refreshes

## Need Help?

- 📖 Full docs: `docs/AUTHENTICATION.md`
- 🔧 Example code: `server/src/auth_validation.rs`
- 🌐 SpacetimeDB docs: https://spacetimedb.com/docs
- 🎯 JWT debugger: https://jwt.io/

## Alternative: Use Existing Auth Service

Instead of building your own OAuth flow, consider:

- **Auth0** - Full-featured auth platform (has free tier)
- **Supabase** - Open-source backend with built-in auth
- **Firebase Auth** - Google's auth solution
- **Clerk** - Modern auth with great UX

These services handle:
- OAuth provider setup
- Token exchange
- JWT signing and validation
- User management
- Password reset flows

Simply integrate their SDK and pass the JWT to ZVote's `authService.loginWithToken()`.
