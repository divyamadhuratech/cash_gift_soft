import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { CeremonyProvider } from './components/ceremony-provider.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CeremonyProvider>
          <App />
        </CeremonyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)