import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { LogoLockup } from '@/components/ceremony/shared'
import { loginPageSubtitle, loginPageTitle } from '@/components/ceremony-provider'
import { useAuth } from '@/contexts/AuthContext'
import { api, googleLoginUrl } from '@/lib/api'

/** Google's four-colour mark, inlined so no extra request is needed. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.59-5.17 3.59-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.55V6.61H1.27a12 12 0 0 0 0 10.79l4-3.13Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.27 6.61l4 3.11C6.22 6.87 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

export function LoginScreen() {
  const navigate = useNavigate()
  const { login, error, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localMessage, setLocalMessage] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)

  // Google sign-in only appears once the server confirms an OAuth client is
  // configured, so a fresh install never shows a button that cannot work.
  useEffect(() => {
    let alive = true
    api.get('/auth/google/status')
      .then(({ data }) => { if (alive) setGoogleEnabled(Boolean(data?.configured)) })
      .catch(() => { /* password sign-in still works */ })
    return () => { alive = false }
  }, [])

  async function signIn(event) {
    event.preventDefault()
    setLocalMessage('')
    if (!email.trim() || !password.trim()) {
      setLocalMessage('Enter an email and password to continue.')
      return
    }
    setSubmitting(true)
    const result = await login(email.trim(), password)
    setSubmitting(false)
    if (result.success) {
      navigate('/')
    } else {
      setLocalMessage(result.message || 'Login failed')
    }
  }

  if (isAuthenticated) {
    // Already logged in - redirect handled by navigate; render nothing briefly
    return null
  }

  const message = localMessage || error

  return <main className="login-page">
    <div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" />
    <div className="login-side-note"><span className="login-side-mark">m</span><span>EVERY GIFT, REMEMBERED.</span></div>
    <section className="login-card">
      <LogoLockup centered />
      <div className="mt-9 text-center"><span className="login-kicker"><Sparkles className="size-3.5" />YOUR CELEBRATION DESK</span><h1 className="mt-4 text-3xl font-semibold tracking-tight">{loginPageTitle}</h1><p className="mt-2 text-sm text-muted-foreground">{loginPageSubtitle}</p><p className="tamil-font mt-2 text-sm text-primary">உங்கள் சேகரிப்பு மேசை தயாராக உள்ளது</p></div>
      <form onSubmit={signIn} className="mt-8 flex flex-col gap-5">
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Email</span><span className="login-input-wrap"><UserRound className="size-[18px] text-muted-foreground" /><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></span></label>
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Password</span><span className="login-input-wrap"><LockKeyhole className="size-[18px] text-muted-foreground" /><input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" type={showPassword ? 'text' : 'password'} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} className="flex size-[52px] shrink-0 items-center justify-center text-muted-foreground">{showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button></span></label>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <button type="submit" disabled={submitting} className="login-submit">{submitting ? 'Signing In...' : 'Sign In'} <span className="tamil-font">· உள்நுழை</span><ArrowRight className="ml-auto size-4" /></button>
      </form>
      {googleEnabled && (
        <div className="mt-6">
          <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or · அல்லது</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <button type="button" onClick={() => { window.location.href = googleLoginUrl }} className="login-google">
            <GoogleMark />
            <span>Continue with Google</span>
            <span className="tamil-font">· கூகுள்</span>
          </button>
        </div>
      )}
      <div className="mt-5 rounded-xl border border-[#e7dfcb] bg-[#faf8f0] px-4 py-3 text-center text-xs text-[#796e59]"><span className="font-semibold">New here?</span><span className="mx-2">·</span><Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></div>
      <p className="mt-6 text-center text-[11px] text-muted-foreground">Your workspace stays private to your account.</p>
    </section>
    <div className="login-footer"><span>SRI MURUGAN MAHAL · MADURAI</span><span>தங்களின் ஆசிகளே எங்கள் செல்வம்</span></div>
  </main>
}