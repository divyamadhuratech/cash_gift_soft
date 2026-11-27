import { createContext, useContext } from 'react'

export const CeremonyContext = createContext(null)

export function useCeremony() {
  const context = useContext(CeremonyContext)
  if (!context) throw new Error('useCeremony must be used inside CeremonyProvider')
  return context
}
