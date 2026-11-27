import { useAuth } from '@/contexts/useAuth'
import { CeremonyProvider } from './ceremony-provider'

export function CeremonySession({ children }) {
  const { user, isAuthenticated } = useAuth()
  const sessionKey = isAuthenticated && user ? user.id : 'guest'
  // Login/logout/account change unmounts CeremonyProvider, so all ceremony
  // state is discarded with it. Fresh mount = clean state. No wipe effect.
  return <CeremonyProvider key={sessionKey}>{children}</CeremonyProvider>
}
