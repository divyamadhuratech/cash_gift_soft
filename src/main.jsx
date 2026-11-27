import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { CeremonySession } from './components/ceremony-session.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CeremonySession>
          <App />
        </CeremonySession>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)