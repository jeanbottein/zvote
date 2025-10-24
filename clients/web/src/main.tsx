import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { PreferencesProvider } from './context/PreferencesContext'
import { getBackend } from './lib/backend'
import './style.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/bubbles.css'
import './styles/cards.css'

// Async initialization - automatically selects correct backend
async function initializeApp() {
  // Initialize backend (SpacetimeDB or GraphQL based on config)
  await getBackend();

  // Render the app after backend is ready
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PreferencesProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </PreferencesProvider>
    </React.StrictMode>,
  )
}

// Start the app
initializeApp().catch(console.error);
