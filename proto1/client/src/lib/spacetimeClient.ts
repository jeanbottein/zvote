// Real SpacetimeDB client integration - Direct use of generated SDK
import { DbConnection } from '../generated/index';

let connection: DbConnection | null = null;
let currentUser: { identity: string; token?: string } | null = null;
let connectionCallbacks = new Set<(connected: boolean) => void>();
let focusedVoteId: string | null = null;

const AUTH_TOKEN_KEY = 'auth_token';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days = 180) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  const sameSite = 'SameSite=Lax';
  const path = 'Path=/';
  const secure = location.protocol === 'https:' ? 'Secure' : '';
  document.cookie = `${name}=${value}; ${expires}; ${sameSite}; ${path}${secure ? `; ${secure}` : ''}`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
}

export const spacetimeDB = {
  get currentUser() {
    return currentUser;
  },

  async setFocusedVoteByToken(token: string | null): Promise<void> {
    if (!connection) return;
    if (!token) return;
    try {
      connection
        .subscriptionBuilder()
        .onApplied(() => {
          console.log('Focused subscriptions applied for token');
        })
        .subscribe([
          `SELECT * FROM vote`,
          `SELECT * FROM vote_option WHERE vote_id = (SELECT id FROM vote WHERE token = '${token}')`,
          `SELECT * FROM approval WHERE vote_id = (SELECT id FROM vote WHERE token = '${token}')`,
          `SELECT * FROM judgment WHERE option_id IN (SELECT id FROM vote_option WHERE vote_id = (SELECT id FROM vote WHERE token = '${token}'))`,
        ]);
    } catch (e) {
      console.warn('Failed to apply focused subscriptions by token:', e);
    }
  },
  
  get connection() {
    return connection;
  },

  get focusedVoteId() {
    return focusedVoteId;
  },

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Configuration de connexion
      const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
      const hostForDefault = location.hostname || 'localhost';
      const DEFAULT_SERVER_URI = `${scheme}://${hostForDefault === 'localhost' ? '127.0.0.1' : hostForDefault}:3000`;
      const overrideServerText = (typeof localStorage !== 'undefined' ? localStorage.getItem('server_uri_override') || '' : '').trim();
      const SERVER_URI = (overrideServerText && overrideServerText.toLowerCase() !== 'auto')
        ? overrideServerText
        : DEFAULT_SERVER_URI;
      
      const MODULE_NAME = 'zvote-proto1';
      const prevToken = localStorage.getItem(AUTH_TOKEN_KEY) || getCookie(AUTH_TOKEN_KEY) || '';

      console.log('Connecting to SpacetimeDB:', { SERVER_URI, MODULE_NAME });

      const onConnect = (conn: DbConnection, identity: any, token: string) => {
        console.log('Connected to SpacetimeDB:', { SERVER_URI, MODULE_NAME });
        
        // Make a stable, human-readable identity string for logging and state
        let identityStr = '';
        try {
          // Try to decode JWT payload (base64url)
          const parts = token?.split?.('.') || [];
          if (parts.length === 3) {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = JSON.parse(atob(base64));
            identityStr = json.hex_identity || json.hexIdentity || json.sub || '';
          }
        } catch (e) {
          // ignore decoding errors; we'll fallback below
        }
        if (!identityStr) {
          try {
            const s = identity?.toString?.();
            // Avoid default object toString noise
            if (s && !/\[object .*\]/.test(s)) {
              identityStr = s;
            }
          } catch (_) {
            // ignore
          }
        }
        if (!identityStr) identityStr = 'unknown-identity';

        console.log('Connected to SpacetimeDB!', { identity: identityStr, token });
        connection = conn;
        currentUser = {
          identity: identityStr,
          token
        };
        // Persist token in both localStorage and a cookie (for cross-tab and easy adoption)
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        setCookie(AUTH_TOKEN_KEY, token);
        connectionCallbacks.forEach(cb => cb(true));

        // Subscriptions: if URL carries a path token (/vote/<token>), scope to that vote; else subscribe wide
        let pathToken: string | null = null;
        try {
          const path = window.location.pathname || '/';
          const m = path.match(/^\/vote\/([^/]+)$/);
          pathToken = m ? decodeURIComponent(m[1]) : null;
        } catch {}

        if (pathToken) {
          console.log('Applying focused subscriptions from URL token');
          conn.subscriptionBuilder()
            .onApplied(() => {
              console.log('SpacetimeDB focused subscriptions applied');
              resolve();
            })
            .subscribe([
              `SELECT * FROM vote`,
              `SELECT * FROM vote_option WHERE vote_id = (SELECT id FROM vote WHERE token = '${pathToken}')`,
              `SELECT * FROM approval WHERE vote_id = (SELECT id FROM vote WHERE token = '${pathToken}')`,
              `SELECT * FROM judgment WHERE option_id IN (SELECT id FROM vote_option WHERE vote_id = (SELECT id FROM vote WHERE token = '${pathToken}'))`,
            ]);
        } else {
          // Initial wide subscriptions for lists
          conn.subscriptionBuilder()
            .onApplied(() => {
              console.log('SpacetimeDB subscriptions applied');
              resolve();
            })
            .subscribe([
              'SELECT * FROM vote',
              'SELECT * FROM vote_option', 
              'SELECT * FROM approval',
              'SELECT * FROM judgment'
            ]);
        }
      };

      const onDisconnect = () => {
        console.log('Disconnected from SpacetimeDB');
        connection = null;
        currentUser = null;
        connectionCallbacks.forEach(cb => cb(false));
      };

      const onConnectError = (_ctx: any, err: Error) => {
        console.error('Error connecting to SpacetimeDB:', err);
        reject(err);
      };

      DbConnection.builder()
        .withUri(SERVER_URI)
        .withModuleName(MODULE_NAME)
        .withToken(prevToken)
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build();
    });
  },

  disconnect(): void {
    connection = null;
    currentUser = null;
    connectionCallbacks.forEach(cb => cb(false));
  },

  resetIdentity(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    deleteCookie(AUTH_TOKEN_KEY);
    this.disconnect();
    // Reconnect with fresh identity
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 100);
  },

  // Reconnect to apply focused or wide subscriptions based on URL token
  refocus(): void {
    this.disconnect();
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 50);
  },

  // Add focused subscriptions for a single vote so we receive live updates
  // only for this vote in addition to general ones. SDK doesn't expose
  // unsubscribe yet, so we keep the general ones too.
  async setFocusedVote(voteId: string | null): Promise<void> {
    if (focusedVoteId === voteId) return; // no-op if unchanged
    focusedVoteId = voteId;
    if (!connection) return;
    if (!voteId) {
      console.log('Cleared focused vote');
      return;
    }
    try {
      const idLiteral = Number.parseInt(voteId, 10).toString();
      connection
        .subscriptionBuilder()
        .onApplied(() => {
          console.log('Focused subscriptions applied for vote', idLiteral);
        })
        .subscribe([
          `SELECT * FROM vote`,
          `SELECT * FROM vote_option WHERE vote_id = ${idLiteral}`,
          `SELECT * FROM approval WHERE vote_id = ${idLiteral}`,
          `SELECT * FROM judgment WHERE option_id IN (SELECT id FROM vote_option WHERE vote_id = ${idLiteral})`,
        ]);
    } catch (e) {
      console.warn('Failed to apply focused subscriptions:', e);
    }
  },

  async call(reducerName: string, ...args: any[]): Promise<any> {
    if (!connection) {
      throw new Error('Not connected to SpacetimeDB');
    }
    
    try {
      // Use the real SpacetimeDB generated API
      if (reducerName === 'createVote') {
        const [title, options, visibility, votingSystem] = args;
        console.log('Calling createVote reducer:', { title, options, visibility, votingSystem });
        connection.reducers.createVote(title, options, visibility, votingSystem);
        return { success: true };
      }
      
      if (reducerName === 'approve') {
        const [voteId, optionId] = args;
        console.log('Calling approve reducer:', { voteId, optionId });
        connection.reducers.approve(Number.parseInt(voteId, 10), Number.parseInt(optionId, 10));
        return { success: true };
      }
      
      if (reducerName === 'unapprove') {
        const [voteId, optionId] = args;
        console.log('Calling unapprove reducer:', { voteId, optionId });
        connection.reducers.unapprove(Number.parseInt(voteId, 10), Number.parseInt(optionId, 10));
        return { success: true };
      }
      
      if (reducerName === 'castJudgment') {
        const [optionId, mention] = args;
        console.log('Calling castJudgment reducer:', { optionId, mention });
        connection.reducers.castJudgment(parseInt(optionId), mention);
        return { success: true };
      }
      
      throw new Error(`Reducer ${reducerName} not implemented`);
    } catch (error) {
      console.error(`Error calling reducer ${reducerName}:`, error);
      throw error;
    }
  },

  onConnectionChange(callback: (connected: boolean) => void): void {
    connectionCallbacks.add(callback);
  },

  offConnectionChange(callback: (connected: boolean) => void): void {
    connectionCallbacks.delete(callback);
  }
};

// Auto-connect when loaded
if (typeof window !== 'undefined') {
  spacetimeDB.connect().catch(console.error);
}
