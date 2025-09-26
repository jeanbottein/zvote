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
  const [theme, setTheme] = useState<'light' | 'system' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'system' || saved === 'dark') {
        return saved;
      }
      return 'system';
    } catch {
      return 'system';
    }
  });

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

  // Apply theme (light/system/dark) to the DOM
  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch {}
    
    let actualTheme: 'light' | 'dark';
    if (theme === 'system') {
      // Use system preference
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      actualTheme = theme;
    }
    
    document.body.setAttribute('data-theme', actualTheme);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const actualTheme = mediaQuery.matches ? 'dark' : 'light';
      document.body.setAttribute('data-theme', actualTheme);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

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
    <header id="app-header" className="app-header">
      {/* Left menu area, fixed width to keep center title perfectly centered */}
      <div id="header-left" className="header-left">
        {/* Theme toggle moved to menu */}
      </div>

      {/* Centered Title */}
      <h1 id="header-title" className="header-title">
        <button
          id="title-button"
          className="title-button"
          onClick={() => {
            if (onViewChange) onViewChange('home');
            else navigate('/');
          }}
        >
          zvote
        </button>
      </h1>

      {/* Right Menu */}
      <div id="header-actions" className="header-actions">
        <button
          id="menu-toggle"
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Menu"
          aria-expanded={menuOpen}
        >
          <span>⋯</span>
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div id="menu-backdrop" className="menu-backdrop" onClick={() => setMenuOpen(false)} />

            {/* Menu Dropdown */}
            <div id="menu-dropdown" className="menu-dropdown">
              <div>
                {/* User Identity Display */}
                <div id="menu-info" className="menu-info">
                  <div>User: <code id="menu-user-id" className="menu-user-id">
                    {user ? formatIdentity(user.identity) : '—'}
                  </code></div>
                  <div id="menu-status" className="menu-status">
                    Status: <span id="menu-status-text" className={connected ? 'status-connected' : 'status-disconnected'}>
                      {connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Menu Items */}
                <button
                  id="menu-random-user"
                  className="menu-item"
                  onClick={handleResetIdentity}
                  disabled={!connected}
                >
                  🎲 New Random User
                </button>

                {/* Theme Selector */}
                <div id="menu-theme-section" className="menu-section">
                  <div id="menu-theme-label" className="menu-section-label">Theme</div>
                  <div id="theme-selector" className="theme-selector">
                    <button
                      id="theme-light"
                      className="theme-btn"
                      data-selected={theme === 'light' ? 'true' : 'false'}
                      onClick={() => setTheme('light')}
                      title="Light theme"
                      aria-label="Light theme"
                    >
                      ☀️
                    </button>
                    <button
                      id="theme-system"
                      className="theme-btn theme-btn-middle"
                      data-selected={theme === 'system' ? 'true' : 'false'}
                      onClick={() => setTheme('system')}
                      title="System theme (follows your device setting)"
                      aria-label="System theme"
                    >
                      🖥️
                    </button>
                    <button
                      id="theme-dark"
                      className="theme-btn"
                      data-selected={theme === 'dark' ? 'true' : 'false'}
                      onClick={() => setTheme('dark')}
                      title="Dark theme"
                      aria-label="Dark theme"
                    >
                      🌙
                    </button>
                  </div>
                </div>

                <button
                  id="menu-color-mode"
                  className="menu-item"
                  onClick={handleToggleColorMode}
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
