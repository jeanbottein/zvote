/**
 * Authentication Login Component
 * 
 * Provides UI for users to authenticate with:
 * - Google
 * - Apple
 * - Meta (Facebook)
 * - Email (passwordless)
 * - Continue as Anonymous (default)
 */

import { useRef, useState, useEffect } from 'react';
import { authService, type AuthProvider } from '../lib/authService';
import { spacetimeDB } from '../lib/spacetimeClient';
import '../styles/auth-login.css';

interface AuthLoginProps {
  onAuthenticated?: () => void;
  onCancel?: () => void;
}

const AuthLogin: React.FC<AuthLoginProps> = ({ onAuthenticated, onCancel }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const awaitingValidationRef = useRef(false);
  const unsubErrorRef = useRef<null | (() => void)>(null);
  const unsubValidatedRef = useRef<null | (() => void)>(null);

  // Cleanup any pending listeners if modal unmounts
  useEffect(() => {
    return () => {
      unsubErrorRef.current?.();
      unsubValidatedRef.current?.();
    };
  }, []);

  const handleProviderLogin = async (provider: Exclude<AuthProvider, 'anonymous'>) => {
    setError(null);
    setIsLoading(true);

    try {
      await authService.loginWithProvider(provider);
      onAuthenticated?.();
    } catch (err) {
      console.error('Login failed:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await authService.loginAnonymously();
      onAuthenticated?.();
    } catch (err) {
      console.error('Anonymous login failed:', err);
      setError('Failed to continue anonymously');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!tokenInput.trim()) {
      setError('Please enter a JWT token');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Parse/derive and set auth state; do not close modal yet
      await authService.loginWithToken(tokenInput.trim());
      awaitingValidationRef.current = true;

      // Subscribe to connection result
      unsubErrorRef.current?.();
      unsubValidatedRef.current?.();
      unsubErrorRef.current = spacetimeDB.onAuthError((message) => {
        if (!awaitingValidationRef.current) return;
        setIsLoading(false);
        setError(
          message?.toString()?.length
            ? `Server rejected token: ${message}`
            : 'Server rejected token'
        );
        awaitingValidationRef.current = false;
      });
      unsubValidatedRef.current = spacetimeDB.onAuthValidated(() => {
        if (!awaitingValidationRef.current) return;
        awaitingValidationRef.current = false;
        setIsLoading(false);
        onAuthenticated?.();
        // cleanup
        unsubErrorRef.current?.();
        unsubValidatedRef.current?.();
        unsubErrorRef.current = null;
        unsubValidatedRef.current = null;
      });
    } catch (err) {
      console.error('Token login failed:', err);
      setError(err instanceof Error ? err.message : 'Invalid token');
      setIsLoading(false);
    } finally {
      // keep modal open; callbacks above will resolve success/failure
    }
  };

  return (
    <div className="auth-login-overlay">
      <div className="auth-login-modal">
        <div className="auth-login-header">
          <h2>Welcome to ZVote</h2>
          <p>Choose how you'd like to sign in</p>
        </div>

        <div className="auth-login-content">
          {error && (
            <div className="auth-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!showTokenInput ? (
            <>
              {/* Social Login Buttons */}
              <div className="auth-providers">
                <button
                  className="auth-provider-btn google"
                  onClick={() => handleProviderLogin('google')}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  className="auth-provider-btn apple"
                  onClick={() => handleProviderLogin('apple')}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>

                <button
                  className="auth-provider-btn meta"
                  onClick={() => handleProviderLogin('meta')}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Continue with Meta
                </button>

                <button
                  className="auth-provider-btn email"
                  onClick={() => handleProviderLogin('email')}
                  disabled={isLoading}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Continue with Email
                </button>
              </div>

              <div className="auth-divider">
                <span>or</span>
              </div>

              {/* Anonymous Option */}
              <button
                className="auth-anonymous-btn"
                onClick={handleAnonymousLogin}
                disabled={isLoading}
              >
                Continue as Anonymous
              </button>

              {/* Developer Option */}
              <button
                className="auth-dev-btn"
                onClick={() => setShowTokenInput(true)}
                disabled={isLoading}
              >
                🔧 Developer: Login with JWT
              </button>
            </>
          ) : (
            <>
              {/* Token Input Form */}
              <div className="auth-token-input">
                <label htmlFor="jwt-token">JWT Token</label>
                <textarea
                  id="jwt-token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste your JWT token here..."
                  rows={6}
                  disabled={isLoading}
                />
                <div className="auth-token-buttons">
                  <button
                    className="auth-btn-secondary"
                    onClick={() => {
                      setShowTokenInput(false);
                      setTokenInput('');
                      setError(null);
                    }}
                    disabled={isLoading}
                  >
                    Back
                  </button>
                  <button
                    className="auth-btn-primary"
                    onClick={handleTokenLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Authenticating...' : 'Login'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {onCancel && (
          <div className="auth-login-footer">
            <button className="auth-cancel-btn" onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
          </div>
        )}

        <div className="auth-login-info">
          <p>
            🔒 Your identity is derived from your authentication provider.
            <br />
            Anonymous mode uses SpacetimeDB's default random identity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLogin;
