import { Route, Routes, Navigate } from 'react-router-dom'
import { CalendarScreen } from '@/components/ceremony/calendar-screen'
import { CollectionScreen } from '@/components/ceremony/collection-screen'
import { CompletedScreen } from '@/components/ceremony/completed-screen'
import { DashboardScreen } from '@/components/ceremony/dashboard-screen'
import { DesignerScreen } from '@/components/ceremony/designer-screen'
import { HistoryScreen } from '@/components/ceremony/history-screen'
import { LoginScreen } from '@/components/ceremony/login-screen'
import { GoogleCallbackScreen } from '@/components/ceremony/google-callback-screen'
import { ReceiptScreen } from '@/components/ceremony/receipt-screen'
import { SetupScreen } from '@/components/ceremony/setup-screen'
import { RegisterScreen } from '@/components/ceremony/register-screen'
import { RequireAuth, RedirectIfAuthenticated } from '@/components/RequireAuth'

function App() {
  return (
    <Routes>

      {/* Public authentication routes */}
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
      </Route>

      {/* Google OAuth callback */}
      <Route
        path="/auth/callback"
        element={<GoogleCallbackScreen />}
      />

      {/* Protected application routes */}
      <Route element={<RequireAuth />}> 
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/collection" element={<CollectionScreen />} />
        <Route path="/receipt-preview" element={<ReceiptScreen />} />
        <Route path="/receipt-designer" element={<DesignerScreen />} />
        <Route path="/entries-history" element={<HistoryScreen />} />
        <Route path="/completed" element={<CompletedScreen />} />
        <Route path="/function-setup" element={<SetupScreen />} />

        {/* Unknown protected routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />

    </Routes>
  )
}

export default App
