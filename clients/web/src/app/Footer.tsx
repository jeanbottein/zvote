import { Link } from 'react-router';
import { SOURCE_CODE_URL } from './AboutPage';

export default function Footer() {
  return (
    <footer className="app-footer">
      <p>zvote is free and open source.</p>
      <nav aria-label="About zvote">
        <Link to="/about">About and the science behind it</Link>
        <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer">Source code</a>
      </nav>
    </footer>
  );
}
