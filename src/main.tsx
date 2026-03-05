import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SettingsPage } from './pages/SettingsPage'
import './index.css'

const page = new URLSearchParams(window.location.search).get('page')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {page === 'settings' ? <SettingsPage /> : <App />}
  </React.StrictMode>,
)
