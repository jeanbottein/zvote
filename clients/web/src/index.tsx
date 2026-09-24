import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { applyPreferences, loadPreferences } from './preferences/preferences';
import './style.css';

// Before the first paint, so a chosen theme never flashes the other one.
applyPreferences(loadPreferences());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
