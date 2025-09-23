// Real SpacetimeDB client integration - Direct use of generated SDK
import { DbConnection } from '../generated/index';

let connection: DbConnection | null = null;
let currentUser: { identity: string; token?: string } | null = null;
let connectionCallbacks = new Set<(connected: boolean) => void>();

export const spacetimeDB = {
  get currentUser() {
    return currentUser;
  },
  
  get connection() {
    return connection;
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
      const prevToken = localStorage.getItem('auth_token') || '';

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
        localStorage.setItem('auth_token', token);
        connectionCallbacks.forEach(cb => cb(true));

        // Subscribe to all tables for real-time updates
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
    localStorage.removeItem('auth_token');
    this.disconnect();
    // Reconnect with fresh identity
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 100);
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
        connection.reducers.approve(BigInt(voteId), parseInt(optionId));
        return { success: true };
      }
      
      if (reducerName === 'unapprove') {
        const [voteId, optionId] = args;
        console.log('Calling unapprove reducer:', { voteId, optionId });
        connection.reducers.unapprove(BigInt(voteId), parseInt(optionId));
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
