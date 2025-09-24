import { useState, useEffect } from 'react';
import { spacetimeDB } from '../lib/spacetimeClient';
import { getColorMode, setColorMode as persistColorMode, onColorModeChange } from '../lib/colorMode';

interface HeaderProps {
  onViewChange?: (view: 'home' | 'create' | 'vote') => void;
  currentView?: 'home' | 'create' | 'vote';
}

const Header: React.FC<HeaderProps> = ({ onViewChange, currentView }) => {
  const [user, setUser] = useState(spacetimeDB.currentUser);
  const [connected, setConnected] = useState(false);
  const [colorMode, setColorMode] = useState(getColorMode());

  useEffect(() => {
    const handleConnectionChange = (isConnected: boolean) => {
      setConnected(isConnected);
      if (isConnected) {
        setUser(spacetimeDB.currentUser);
      } else {
        setUser(null);
      }
    };

    spacetimeDB.onConnectionChange(handleConnectionChange);
    const offColor = onColorModeChange(setColorMode);
    return () => {
      spacetimeDB.offConnectionChange(handleConnectionChange);
      offColor?.();
    };
  }, []);

  // Reflect color mode in the DOM for CSS (colorblind-friendly palettes)
  useEffect(() => {
    if (colorMode === 'colorblind') {
      document.body.setAttribute('data-colorblind', 'true');
    } else {
      document.body.removeAttribute('data-colorblind');
    }
  }, [colorMode]);

  const handleResetIdentity = () => {
    if (confirm('Switch to a fresh identity? This will reconnect and give you a new identity.')) {
      spacetimeDB.resetIdentity();
    }
  };


  const handleToggleColorMode = () => {
    const next = colorMode === 'color' ? 'colorblind' : 'color';
    setColorMode(next);
    persistColorMode(next);
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
                className="btn-secondary"
                title="Switch to a fresh identity"
              >
                Switch user
              </button>
            </div>

            {/* Color mode toggle */}
            <div>
              <button
                onClick={handleToggleColorMode}
                className="btn-secondary"
                title="Toggle colorblind-friendly grayscale palette"
              >
                {colorMode === 'color' ? 'Colorblind' : 'Colors'}
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
