import { useState, useEffect } from 'react';
import { spacetimeDB } from '../lib/spacetimeClient';

interface HeaderProps {
  onViewChange?: (view: 'home' | 'create' | 'vote') => void;
  currentView?: 'home' | 'create' | 'vote';
}

const Header: React.FC<HeaderProps> = ({ onViewChange, currentView }) => {
  const [user, setUser] = useState(spacetimeDB.currentUser);
  const [connected, setConnected] = useState(false);
  const [serverHost, setServerHost] = useState('');
  const [currentServerUri, setCurrentServerUri] = useState('');

  useEffect(() => {
    // Set default server URI display
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const hostForDefault = location.hostname || 'localhost';
    const defaultUri = `${scheme}://${hostForDefault === 'localhost' ? '127.0.0.1' : hostForDefault}:3000`;
    const overrideUri = localStorage.getItem('server_uri_override');
    
    setCurrentServerUri(overrideUri || defaultUri);
    
    const handleConnectionChange = (isConnected: boolean) => {
      setConnected(isConnected);
      if (isConnected) {
        setUser(spacetimeDB.currentUser);
      } else {
        setUser(null);
      }
    };

    spacetimeDB.onConnectionChange(handleConnectionChange);
    return () => spacetimeDB.offConnectionChange(handleConnectionChange);
  }, []);

  const handleResetIdentity = () => {
    if (confirm('Switch to a fresh identity? This will reconnect and give you a new identity.')) {
      spacetimeDB.resetIdentity();
    }
  };

  const handleSetServer = () => {
    if (!serverHost.trim()) return;
    
    try {
      // Validate server URI format
      const nextUri = serverHost.startsWith('ws://') || serverHost.startsWith('wss://') 
        ? serverHost 
        : `ws://${serverHost}`;
      
      localStorage.setItem('server_uri_override', nextUri);
      location.reload();
    } catch {
      alert('Invalid server URI. Use ws://host:port or wss://host:port');
    }
  };

  const handleResetServer = () => {
    localStorage.removeItem('server_uri_override');
    location.reload();
  };

  const formatIdentity = (identity: string) => {
    return identity.length > 16 ? identity.slice(0, 16) + '…' : identity;
  };

  return (
    <header>
      <h1>
        <button
          onClick={() => onViewChange?.('home')}
          style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        >
          zvote — proto1
        </button>
      </h1>
      
      <div className="header-right">
            {/* Identity section */}
            <div className="identity">
              <span className="muted">You:</span>
              <code>
                {user ? formatIdentity(user.identity) : '—'}
              </code>
              <button
                onClick={handleResetIdentity}
                disabled={!connected}
                className="secondary"
                title="Reconnect with a fresh identity"
              >
                New identity
              </button>
            </div>

            {/* Server section */}
            <div className="server">
              <span className="muted">Server:</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', marginRight: '8px' }}>
                {currentServerUri}
              </span>
              <input
                type="text"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="host or ws://..."
              />
              <button
                onClick={handleSetServer}
                className="primary"
              >
                Set
              </button>
              <button
                onClick={handleResetServer}
                className="secondary"
              >
                Reset
              </button>
            </div>

        {/* Connection status indicator (optional) */}
        {/* <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connected ? '#26a69a' : '#f44336', marginRight: '4px' }} />
          {connected ? 'Connected' : 'Disconnected'}
        </div> */}
      </div>
    </header>
  );
};

export default Header;
