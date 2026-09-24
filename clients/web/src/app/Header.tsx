import { Link, useLocation } from 'react-router';
import { BackIcon } from '../ui/icons';
import SettingsMenu from './SettingsMenu';

export default function Header() {
  const atHome = useLocation().pathname === '/';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {atHome ? (
          <span className="icon-button-placeholder" />
        ) : (
          <Link to="/" className="icon-button" aria-label="All polls">
            <BackIcon />
          </Link>
        )}
        <Link to="/" className="brand">zvote</Link>
        <SettingsMenu />
      </div>
    </header>
  );
}
