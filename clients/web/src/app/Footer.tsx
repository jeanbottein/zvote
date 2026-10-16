import { Link } from 'react-router';
import AppName from '../ui/AppName';
import { SOURCE_CODE_URL } from './AboutPage';

export default function Footer() {
  return (
    <footer className="app-footer">
      <p><AppName /> is free and open source.</p>
      <nav aria-label="About super-vote">
        <Link to="/about">About and the science behind it</Link>
        <Link to="/statistics">Statistics</Link>
        <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer">Source code</a>
      </nav>
    </footer>
  );
}
