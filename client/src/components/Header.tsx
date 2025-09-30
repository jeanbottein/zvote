import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { spacetimeDB } from '../lib/spacetimeClient';
import { getColorMode, setColorMode as persistColorMode, onColorModeChange } from '../lib/colorMode';
import { useVoteByToken } from '../hooks/useVoteByToken';
import { rankOptions } from '../utils/majorityJudgment';

interface HeaderProps {
  onViewChange?: (view: 'home' | 'create' | 'vote') => void;
}

const Header: React.FC<HeaderProps> = ({ onViewChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Determine if we should show the back button
  const shouldShowBackButton = () => {
    const path = location.pathname;
    return path !== '/' && (
      path.startsWith('/create') ||
      path.startsWith('/approval/') ||
      path.startsWith('/judgment/') ||
      path.startsWith('/vote/')
    );
  };

  const handleGoBack = () => {
    if (onViewChange) {
      onViewChange('home');
    } else {
      navigate('/');
    }
  };

  // Check if we're on a vote page and get the token
  const getVoteToken = () => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    
    if (path.startsWith('/approval/') || path.startsWith('/judgment/')) {
      return searchParams.get('token');
    }
    return null;
  };

  const isOnVotePage = () => {
    const path = location.pathname;
    return path.startsWith('/approval/') || path.startsWith('/judgment/');
  };

  // Get vote data for export
  const voteToken = getVoteToken();
  const { vote } = useVoteByToken(voteToken);

  const handleExportResults = () => {
    if (!vote) {
      alert('No vote data available to export');
      return;
    }

    try {
      let exportData: any = {
        vote: {
          id: vote.id,
          title: vote.title,
          visibility: vote.visibility,
          voting_system: vote.voting_system,
          created_at: vote.created_at,
          creator: vote.creator,
          token: vote.token,
        },
        options: vote.options || [],
        export_timestamp: new Date().toISOString(),
      };

      // Add system-specific analysis
      if (vote.voting_system?.tag === 'MajorityJudgment') {
        // Filter options that have judgment data
        const optionsWithJudgments = (vote.options || []).filter(
          opt => opt.judgment_counts && opt.total_judgments !== undefined
        );
        
        if (optionsWithJudgments.length > 0) {
          const rankedOptions = rankOptions(optionsWithJudgments as any);
          exportData.majority_judgment_analysis = {
            ranked_options: rankedOptions.map(option => ({
              id: option.id,
              label: option.label,
              rank: option.mjAnalysis.rank,
              majority_mention: option.mjAnalysis.majorityMention,
              gmd_score: option.mjAnalysis.gmdScore,
              is_winner: option.mjAnalysis.isWinner,
              is_ex_aequo: option.mjAnalysis.isExAequo,
              judgment_counts: option.judgment_counts,
              total_judgments: option.total_judgments,
            })),
            winners: rankedOptions.filter(opt => opt.mjAnalysis.rank === 1),
          };
        }
      } else if (vote.voting_system?.tag === 'Approval') {
        const totalVoters = Math.max(...(vote.options || []).map(o => o.approvals_count || 0), 0);
        exportData.approval_analysis = {
          total_voters: totalVoters,
          options_by_approvals: (vote.options || [])
            .map(option => ({
              id: option.id,
              label: option.label,
              approvals_count: option.approvals_count || 0,
              approval_percentage: totalVoters > 0 ? ((option.approvals_count || 0) / totalVoters * 100) : 0,
            }))
            .sort((a, b) => b.approvals_count - a.approvals_count),
        };
      }

      // Create and download JSON file
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `zvote-results-${vote.id}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMenuOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export results. Please try again.');
    }
  };

  return (
    <header id="app-header" className="app-header">
      {/* Left menu area, fixed width to keep center title perfectly centered */}
      <div id="header-left" className="header-left">
        {shouldShowBackButton() && (
          <button
            id="back-button"
            className="back-button"
            onClick={handleGoBack}
            title="Go back"
            aria-label="Go back to home"
          >
            ←
          </button>
        )}
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
                {isOnVotePage() && vote && (
                  <button
                    id="menu-export-results"
                    className="menu-item"
                    onClick={handleExportResults}
                    disabled={!connected}
                  >
                    📊 Export Results (JSON)
                  </button>
                )}

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
