import { Link, useLocation } from 'react-router';
import { BackIcon } from '../ui/icons';
import Logo from '../ui/Logo';
import SettingsMenu from './SettingsMenu';

export default function Header() {
  const atHome = useLocation().pathname === '/';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        {atHome ? (
          <span className="icon-button-placeholder" />
        ) : (
          <Link to="/" className="icon-button" aria-label="Home">
            <BackIcon />
          </Link>
        )}
        <Link to="/" className="brand"><Logo />zvote</Link>
        <SettingsMenu />
      </div>
    </header>
  );
}
