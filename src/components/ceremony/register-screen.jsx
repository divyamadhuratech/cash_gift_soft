import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { LogoLockup } from '@/components/ceremony/shared'
import { useAuth } from '@/contexts/AuthContext'

export function RegisterScreen() {
  const navigate = useNavigate()
  const { register, error, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localMessage, setLocalMessage] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    setLocalMessage('')
    if (!email.trim() || !password.trim()) {
      setLocalMessage('Email and password are required.')
      return
    }
    if (password !== confirm) {
      setLocalMessage('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setLocalMessage('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    const result = await register(email.trim(), password, displayName.trim())
    setSubmitting(false)
    if (result.success) {
      navigate('/')
    } else {
      setLocalMessage(result.message || 'Registration failed')
    }
  }

  if (isAuthenticated) return null

  const message = localMessage || error


  return <main className="login-page">
    <div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" />
    <div className="login-side-note"><span className="login-side-mark">m</span><span>EVERY GIFT, REMEMBERED.</span></div>
    <section className="login-card">
      <LogoLockup centered />
      <div className="mt-9 text-center"><span className="login-kicker"><Sparkles className="size-3.5" />YOUR CELEBRATION DESK</span><h1 className="mt-4 text-3xl font-semibold tracking-tight">Create your account</h1><p className="mt-2 text-sm text-muted-foreground">Set up your private collection workspace.</p><p className="tamil-font mt-2 text-sm text-primary">உங்கள் சேகரிப்பு இடத்தை உருவாக்குங்கள்</p></div>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Name</span><span className="login-input-wrap"><UserRound className="size-[18px] text-muted-foreground" /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="Ananth" /></span></label>
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Email</span><span className="login-input-wrap"><UserRound className="size-[18px] text-muted-foreground" /><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Alex@example.com" required /></span></label>
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Password</span><span className="login-input-wrap"><LockKeyhole className="size-[18px] text-muted-foreground" /><input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Min 6 characters" type={showPassword ? 'text' : 'password'} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} className="flex size-[52px] shrink-0 items-center justify-center text-muted-foreground">{showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button></span></label>
        <label className="login-field"><span className="mb-2 block text-sm font-semibold">Confirm Password</span><span className="login-input-wrap"><LockKeyhole className="size-[18px] text-muted-foreground" /><input value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Repeat password" type={showPassword ? 'text' : 'password'} required /></span></label>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <button type="submit" disabled={submitting} className="login-submit">{submitting ? 'Creating...' : 'Create Account'} <span className="tamil-font">· கணக்கை உருவாக்கு</span><ArrowRight className="ml-auto size-4" /></button>
      </form>
      <div className="mt-5 rounded-xl border border-[#e7dfcb] bg-[#faf8f0] px-4 py-3 text-center text-xs text-[#796e59]"><span className="font-semibold">Already have an account?</span><span className="mx-2">·</span><Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></div>
    </section>
    <div className="login-footer"><span>SRI MURUGAN MAHAL · MADURAI</span><span>தங்களின் ஆசிகளே எங்கள் செல்வம்</span></div>
  </main>
}