import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spacetimeDB } from '../lib/spacetimeClient';
import { getColorMode, setColorMode as persistColorMode, onColorModeChange } from '../lib/colorMode';

interface HeaderProps {
  onViewChange?: (view: 'home' | 'create' | 'vote') => void;
}

const Header: React.FC<HeaderProps> = ({ onViewChange }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(spacetimeDB.currentUser);
  const [connected, setConnected] = useState(false);
  const [colorMode, setColorMode] = useState(getColorMode());
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
  };

  const handleToggleColorMode = () => {
    const next = colorMode === 'color' ? 'colorblind' : 'color';
    setColorMode(next);
    persistColorMode(next);
    setMenuOpen(false);
  };

  const formatIdentity = (identity: string) => {
    return identity.length > 16 ? identity.slice(0, 16) + '…' : identity;
  };

  return (
    <header style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      borderBottom: '1px solid #e5e7eb',
      position: 'relative'
    }}>
      {/* Left spacer for balance */}
      <div style={{ width: '120px' }} />
      
      {/* Centered Title */}
      <h1 style={{ 
        margin: 0, 
        fontSize: '1.5rem', 
        fontWeight: 'bold',
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)'
      }}>
        <button
          onClick={() => {
            if (onViewChange) onViewChange('home');
            else navigate('/');
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'inherit', 
            font: 'inherit', 
            cursor: 'pointer',
            fontSize: 'inherit',
            fontWeight: 'inherit'
          }}
        >
          zvote
        </button>
      </h1>
      
      {/* Right Menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Menu"
        >
          <span>⋯</span>
        </button>
        
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10
              }}
              onClick={() => setMenuOpen(false)}
            />
            
            {/* Menu Dropdown */}
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              minWidth: '200px',
              zIndex: 20
            }}>
              <div style={{ padding: '8px 0' }}>
                {/* User Identity Display */}
                <div style={{ 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  <div>User: <code style={{ fontSize: '11px' }}>
                    {user ? formatIdentity(user.identity) : '—'}
                  </code></div>
                  <div style={{ marginTop: '2px' }}>
                    Status: <span style={{ color: connected ? '#10b981' : '#ef4444' }}>
                      {connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                {/* Menu Items */}
                <button
                  onClick={handleResetIdentity}
                  disabled={!connected}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: connected ? 'pointer' : 'not-allowed',
                    opacity: connected ? 1 : 0.5,
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    if (connected) e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  🎲 New Random User
                </button>
                
                <button
                  onClick={handleToggleColorMode}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {colorMode === 'color' ? '🎨 Colorblind Mode' : '🌈 Color Mode'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
