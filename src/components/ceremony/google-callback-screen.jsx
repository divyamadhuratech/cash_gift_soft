import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, TriangleAlert } from 'lucide-react'
import { LogoLockup } from '@/components/ceremony/shared'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Where Google sends the browser back to (FRONTEND_URL/auth/callback).
 *
 * The token travels in the URL *hash* so it is never part of the request path
 * the dev server or any proxy would log, and it is scrubbed from history the
 * moment it is read.
 */
export function GoogleCallbackScreen() {
  const navigate = useNavigate()
  const { completeGoogleLogin } = useAuth()
  const [message, setMessage] = useState('')
  const started = useRef(false)

  useEffect(() => {
    // A second effect run would spend the token twice.
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('token')
    const failure = params.get('error')
    window.history.replaceState(null, '', window.location.pathname)

    if (failure) {
      setMessage(failure)
      return
    }
    if (!token) {
      setMessage('Google did not return a sign-in result. Please try again.')
      return
    }

    completeGoogleLogin(token).then((result) => {
      if (result.success) navigate('/', { replace: true })
      else setMessage(result.message || 'Google sign-in failed')
    })
  }, [completeGoogleLogin, navigate])

  if (message) {
    return (
      <main className="login-page">
        <section className="login-card">
          <LogoLockup centered />
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <TriangleAlert className="size-5" />
            </span>
            <h1 className="text-xl font-semibold">Google sign-in did not finish</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link to="/login" className="login-submit mt-2">Back to sign in</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <LogoLockup centered />
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finishing your Google sign-in…</p>
        </div>
      </section>
    </main>
  )
}

export default GoogleCallbackScreen
