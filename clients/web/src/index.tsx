import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { applyPreferences, loadPreferences } from './preferences/preferences';
import './style.css';

// Before the first render: the grey palette and the browser's bars. (index.html set the appearance already,
// before the first paint.)
applyPreferences(loadPreferences());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
