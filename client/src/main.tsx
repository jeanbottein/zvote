import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { PreferencesProvider } from './context/PreferencesContext'
import './lib/spacetimeClient'
import './style.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/bubbles.css'
import './styles/cards.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </PreferencesProvider>
  </React.StrictMode>,
)
