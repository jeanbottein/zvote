/**
 * OpenID Connect Authentication Service
 * 
 * Manages authentication flows for multiple providers:
 * - Google
 * - Apple
 * - Meta (Facebook)
 * - Email-based (passwordless)
 * 
 * This service handles:
 * 1. OAuth 2.0 / OIDC flows
 * 2. JWT token acquisition and storage
 * 3. Identity derivation for SpacetimeDB
 * 4. Session management
 */

import { deriveIdentityFromClaims, extractIdentityClaims, parseJWT } from './identityDerivation';

const AUTH_TOKEN_KEY = 'zvote_auth_token';
const AUTH_PROVIDER_KEY = 'zvote_auth_provider';
const AUTH_USER_INFO_KEY = 'zvote_auth_user_info';

export type AuthProvider = 'google' | 'apple' | 'meta' | 'email' | 'anonymous';

export interface AuthUser {
  identity: string; // SpacetimeDB identity (derived from JWT)
  token: string; // JWT token
  provider: AuthProvider;
  email?: string;
  name?: string;
  issuer: string;
  subject: string;
}

export interface OIDCConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  authEndpoint: string;
  tokenEndpoint: string;
}

// OIDC configurations for different providers
// NOTE: You need to create OAuth apps for each provider and configure these
const OIDC_CONFIGS: Record<Exclude<AuthProvider, 'anonymous'>, Partial<OIDCConfig>> = {
  google: {
    clientId: process.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  apple: {
    clientId: process.env.VITE_APPLE_CLIENT_ID || 'YOUR_APPLE_CLIENT_ID',
    authEndpoint: 'https://appleid.apple.com/auth/authorize',
    tokenEndpoint: 'https://appleid.apple.com/auth/token',
    scope: 'openid email name',
  },
  meta: {
    clientId: process.env.VITE_META_CLIENT_ID || 'YOUR_META_CLIENT_ID',
    authEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenEndpoint: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scope: 'openid email public_profile',
  },
  email: {
    // For email-based auth, you'd use a service like Auth0, Supabase, or your own backend
    clientId: process.env.VITE_EMAIL_CLIENT_ID || 'YOUR_EMAIL_CLIENT_ID',
    authEndpoint: process.env.VITE_EMAIL_AUTH_ENDPOINT || '',
    tokenEndpoint: process.env.VITE_EMAIL_TOKEN_ENDPOINT || '',
    scope: 'openid email',
  },
};

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();

  constructor() {
    this.loadStoredAuth();
  }

  /**
   * Load stored authentication from localStorage
   */
  private loadStoredAuth() {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const provider = localStorage.getItem(AUTH_PROVIDER_KEY) as AuthProvider;
      const userInfoStr = localStorage.getItem(AUTH_USER_INFO_KEY);

      if (token && provider && userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        this.currentUser = {
          token,
          provider,
          ...userInfo,
        };
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      this.clearAuth();
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Start OAuth/OIDC login flow for a provider
   */
  async loginWithProvider(provider: Exclude<AuthProvider, 'anonymous'>): Promise<void> {
    const config = OIDC_CONFIGS[provider];
    
    if (!config.clientId || !config.authEndpoint) {
      throw new Error(`${provider} authentication not configured. Please set up OAuth credentials.`);
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = this.generateRandomState();
    const nonce = this.generateRandomState();

    // Store state for CSRF protection
    sessionStorage.setItem('auth_state', state);
    sessionStorage.setItem('auth_provider', provider);

    // Build authorization URL
    const authUrl = new URL(config.authEndpoint);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scope || 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);

    // Redirect to provider
    window.location.href = authUrl.toString();
  }

  /**
   * Handle OAuth callback (authorization code flow)
   * This is a simplified version - in production, you'd exchange the code on your backend
   */
  async handleCallback(code: string, state: string): Promise<AuthUser> {
    const storedState = sessionStorage.getItem('auth_state');
    const provider = sessionStorage.getItem('auth_provider') as AuthProvider;

    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    if (!provider) {
      throw new Error('Provider not found in session');
    }

    // In a real implementation, you would:
    // 1. Send the authorization code to your backend
    // 2. Backend exchanges code for tokens with the provider
    // 3. Backend validates the JWT and returns it to the client
    
    // For demonstration, we'll simulate this:
    throw new Error('OAuth callback handling requires backend implementation. Please set up a token exchange endpoint.');
  }

  /**
   * Login with a JWT token directly (for testing or custom flows)
   */
  async loginWithToken(token: string, provider: AuthProvider = 'email'): Promise<AuthUser> {
    try {
      // Extract and validate claims
      const claims = extractIdentityClaims(token);
      
      // Derive SpacetimeDB identity
      const identity = await deriveIdentityFromClaims(claims.issuer, claims.subject);
      
      // Create user object
      const user: AuthUser = {
        identity,
        token,
        provider,
        email: claims.email,
        name: claims.name,
        issuer: claims.issuer,
        subject: claims.subject,
      };

      // Store auth
      this.setAuth(user);
      
      return user;
    } catch (error) {
      console.error('Login with token failed:', error);
      throw new Error('Invalid authentication token');
    }
  }

  /**
   * Login anonymously (current behavior)
   */
  async loginAnonymously(): Promise<void> {
    this.currentUser = null;
    this.clearAuth();
    this.notifyListeners();
  }

  /**
   * Logout current user
   */
  logout() {
    this.clearAuth();
    this.notifyListeners();
  }

  /**
   * Store authentication
   */
  private setAuth(user: AuthUser) {
    this.currentUser = user;
    
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, user.token);
      localStorage.setItem(AUTH_PROVIDER_KEY, user.provider);
      localStorage.setItem(AUTH_USER_INFO_KEY, JSON.stringify({
        identity: user.identity,
        email: user.email,
        name: user.name,
        issuer: user.issuer,
        subject: user.subject,
      }));
    } catch (error) {
      console.error('Failed to store auth:', error);
    }

    this.notifyListeners();
  }

  /**
   * Clear stored authentication
   */
  private clearAuth() {
    this.currentUser = null;
    
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_PROVIDER_KEY);
      localStorage.removeItem(AUTH_USER_INFO_KEY);
    } catch (error) {
      console.error('Failed to clear auth:', error);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.add(callback);
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of auth change
   */
  private notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (error) {
        console.error('Auth listener error:', error);
      }
    });
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateRandomState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate and refresh token if needed
   */
  async validateToken(): Promise<boolean> {
    if (!this.currentUser) {
      return false;
    }

    try {
      // Parse JWT to check expiration
      const payload = parseJWT(this.currentUser.token);
      
      if (payload.exp) {
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        if (now >= expirationTime) {
          console.log('Token expired');
          this.logout();
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      this.logout();
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
