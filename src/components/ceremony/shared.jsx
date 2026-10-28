import { ArrowLeft, ArrowRight, CalendarDays, CirclePlus, LogOut, Moon, Sun, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCeremony, formatScheduleDate, localized, logoWord, normalizeReceiptDesign, appTagline } from '@/components/ceremony-provider'
import { useAuth } from '@/contexts/AuthContext'
import { templateById } from '@/lib/design-templates'
import { formatINR } from '@/components/ceremony/types'
import { ReceiptFrame } from '@/components/ceremony/receipt-renderer'
import { cn } from '@/lib/utils'

export function BrandMark({ inverse = false }) {
  const { uiLanguage } = useCeremony()
  return (
    <Link to="/" aria-label={localized(uiLanguage, 'Muhurtham dashboard', 'முகூர்த்தம் முகப்பு')} className="flex items-center gap-2.5">
      <span className={cn('brand-mark', inverse && 'brand-mark-inverse')}>m</span>
      <span className="flex flex-col leading-none">
        <span className="brand-word">{logoWord}</span>
        <span className="mt-1 hidden text-[10px] tracking-[0.12em] text-muted-foreground sm:block">{appTagline}</span>
      </span>
    </Link>
  )
}

export function AppShell({ children, background }) {
  const { pathname } = useLocation()
  const { isDark, toggleDark, functionDetails, uiLanguage, setUiLanguage } = useCeremony()
  const { user, logout } = useAuth()
  const isHome = pathname === '/'
  const languageToggle = (variant) => (
    <div className={`language-toggle language-toggle-${variant}`} role="group" aria-label={localized(uiLanguage, 'Dashboard language', 'டாஷ்போர்டு மொழி')}>
      <button type="button" onClick={() => setUiLanguage('English')} aria-pressed={uiLanguage === 'English'} className={cn('language-toggle-option', uiLanguage === 'English' && 'language-toggle-option-active')}>EN</button>
      <span aria-hidden="true" className="language-toggle-divider">|</span>
      <button type="button" onClick={() => setUiLanguage('Tamil')} aria-pressed={uiLanguage === 'Tamil'} className={cn('language-toggle-option tamil-font', uiLanguage === 'Tamil' && 'language-toggle-option-active')}>தமிழ்</button>
    </div>
  )
  const activeFunctionChip = (compact = false) => {
    if (!functionDetails) {
      return <Link
        to="/function-setup"
        className={cn('active-function-chip', compact && 'active-function-chip-compact')}
        title={localized(uiLanguage, 'Create your first function', 'உங்கள் முதல் நிகழ்ச்சியை உருவாக்கவும்')}
      >
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold leading-tight">{localized(uiLanguage, 'Set up a function', 'நிகழ்ச்சியை அமைக்கவும்')}</span>
          <span className="block truncate text-[10px] leading-tight text-muted-foreground">{localized(uiLanguage, 'Nothing scheduled yet', 'இன்னும் எதுவும் திட்டமிடப்படவில்லை')}</span>
        </span>
      </Link>
    }
    return (
      <Link
        to="/calendar"
        className={cn('active-function-chip', compact && 'active-function-chip-compact')}
        title={localized(uiLanguage, 'View function calendar', 'நிகழ்ச்சி நாட்காட்டியைப் பார்க்கவும்')}
      >
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold leading-tight">{functionDetails.name}</span>
          <span className={cn('block truncate text-[10px] leading-tight text-muted-foreground', uiLanguage === 'Tamil' && 'tamil-font')}>{functionDetails.date ? formatScheduleDate(functionDetails.date, { withYear: false }) : localized(uiLanguage, 'Date not set', 'தேதி அமைக்கப்படவில்லை')} · {functionDetails.venue}</span>
        </span>
      </Link>
    )
  }
  return (
    <div className={cn('app-shell text-foreground', !background && 'bg-background')}>
      {background && <div className="app-backdrop" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />}
      <header className={cn('app-topbar sticky top-0 z-30 border-b border-border/70 backdrop-blur-xl', background ? 'app-topbar-glass' : 'bg-background/90')}>
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-7">
            <BrandMark />
            <div className="hidden h-9 w-px bg-border lg:block" />
            <div className="hidden min-w-0 lg:block">{activeFunctionChip()}</div>
          </div>
          <nav aria-label={localized(uiLanguage, 'Primary navigation', 'முதன்மை வழிசெலுத்தல்')} className="hidden items-center gap-1 lg:flex">
            {[{ english: 'Dashboard', tamil: 'முகப்பு', to: '/' }, { english: 'Collection', tamil: 'சேகரிப்பு', to: '/collection' }, { english: 'Entries', tamil: 'பதிவுகள்', to: '/entries-history' }, { english: 'Completed', tamil: 'நிறைவு', to: '/completed' }].map((item) => (
              <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={cn('nav-link', pathname === item.to && 'nav-link-active')}>{localized(uiLanguage, item.english, item.tamil)}</Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/calendar" aria-label={localized(uiLanguage, 'Function calendar', 'நிகழ்ச்சி நாட்காட்டி')} title={localized(uiLanguage, 'Function calendar', 'நிகழ்ச்சி நாட்காட்டி')} className={cn('icon-button', pathname === '/calendar' && 'border-primary text-primary')}>
              <CalendarDays className="size-[18px]" />
            </Link>
            <button type="button" onClick={toggleDark} aria-label={isDark ? localized(uiLanguage, 'Switch to light mode', 'ஒளி பயன்முறைக்கு மாறவும்') : localized(uiLanguage, 'Switch to dark mode', 'இருள் பயன்முறைக்கு மாறவும்')} className="icon-button hidden sm:inline-flex">{isDark ? <Sun /> : <Moon />}</button>
            {languageToggle('desktop')}
            <Link to={isHome ? '/collection' : '/'} className={cn('dashboard-back', isHome && 'dashboard-collect')}>
              {isHome ? <CirclePlus className="size-4" /> : <ArrowLeft className="size-4" />}
              <span className="hidden sm:inline">{localized(uiLanguage, isHome ? 'Start Collection' : 'Back to Dashboard', isHome ? 'சேகரிப்பைத் தொடங்கு' : 'முகப்புக்குத் திரும்பு')}</span><span className="sm:hidden">{localized(uiLanguage, isHome ? 'Collect' : 'Dashboard', isHome ? 'சேகரி' : 'முகப்பு')}</span>
            </Link>
            <div className="profile-avatar" aria-label={`${user?.displayName || user?.email || 'Guest'}, ${localized(uiLanguage, 'event organizer', 'நிகழ்ச்சி ஒருங்கிணைப்பாளர்')}`} title={user?.displayName || user?.email || 'Guest'}>{(user?.displayName || user?.email || 'Guest').slice(0, 2).toUpperCase()}</div>
            <button type="button" onClick={logout} aria-label={localized(uiLanguage, 'Sign out', 'புறந்துவிடு')} title={localized(uiLanguage, 'Sign out', 'புறந்துவிடு')} className="icon-button icon-button-danger"><LogOut className="size-4" /></button>
          </div>
        </div>
        <div className="function-strip lg:hidden"><Sparkles className="size-3.5 shrink-0 text-gold" />{activeFunctionChip(true)}{languageToggle('mobile')}<button type="button" onClick={toggleDark} aria-label={isDark ? localized(uiLanguage, 'Switch to light mode', 'ஒளி பயன்முறைக்கு மாறவும்') : localized(uiLanguage, 'Switch to dark mode', 'இருள் பயன்முறைக்கு மாறவும்')} className="mobile-mode-toggle sm:hidden">{isDark ? <Sun /> : <Moon />}</button></div>
        <div className="mobile-nav lg:hidden" aria-label={localized(uiLanguage, 'Application navigation', 'பயன்பாட்டு வழிசெலுத்தல்')}>
          {[{ english: 'Home', tamil: 'முகப்பு', to: '/' }, { english: 'Collect', tamil: 'சேகரி', to: '/collection' }, { english: 'History', tamil: 'வரலாறு', to: '/entries-history' }, { english: 'Done', tamil: 'நிறைவு', to: '/completed' }].map((item) => (
            <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={cn('mobile-nav-link', pathname === item.to && 'mobile-nav-link-active')}>{localized(uiLanguage, item.english, item.tamil)}</Link>
          ))}
        </div>
      </header>
      <main className="app-shell-main mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">{children}</main>
    </div>
  )
}

export function PageHeading({ eyebrow, eyebrowTamil, title, titleTamil, subtitle, subtitleTamil, action }) {
  const { uiLanguage } = useCeremony()
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end"><div>{eyebrow && <p className="eyebrow">{localized(uiLanguage, eyebrow, eyebrowTamil ?? eyebrow)}</p>}<h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{localized(uiLanguage, title, titleTamil ?? title)}</h1>{subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{localized(uiLanguage, subtitle, subtitleTamil ?? subtitle)}</p>}</div>{action}</div>
}

export function Surface({ children, className }) {
  return <section className={cn('surface-card', className)}>{children}</section>
}

export function UiText({ english, tamil, className }) {
  const { uiLanguage } = useCeremony()
  return <span className={cn(uiLanguage === 'Tamil' && 'tamil-font', className)}>{localized(uiLanguage, english, tamil)}</span>
}

export function Bilingual({ english, tamil, className }) {
  return <UiText english={english} tamil={tamil} className={className} />
}

const paymentTamil = { Cash: 'ரொக்கம்', UPI: 'யூபிஐ', Card: 'அட்டை', Other: 'மற்றவை' }

export function PaymentBadge({ mode }) {
  const { uiLanguage } = useCeremony()
  return <span className={cn('payment-badge', `payment-${mode.toLowerCase()}`)}><span className="payment-dot" />{localized(uiLanguage, mode, paymentTamil[mode])}</span>
}

const statusTamil = { Active: 'செயலில்', Upcoming: 'வரவிருக்கிறது', Completed: 'நிறைவு' }

export function StatusBadge({ status }) {
  const { uiLanguage } = useCeremony()
  return <span className={cn('status-badge', `status-${status.toLowerCase()}`)}><span className="status-dot" />{localized(uiLanguage, status, statusTamil[status] ?? status)}</span>
}

export function Amount({ value, className }) {
  return <span className={cn('tabular-nums', className)}>{formatINR(value)}</span>
}

export function TextLink({ href, children }) {
  return <Link to={href} className="text-link">{children}<ArrowRight className="size-4" /></Link>
}

export function LogoLockup({ centered = false }) {
  return <div className={cn('flex items-center gap-3', centered && 'justify-center')}><span className="brand-mark size-12 text-2xl">m</span><span className="flex flex-col"><span className="brand-word text-lg">muhurtham</span><span className="text-xs text-muted-foreground">Every gift, remembered.</span></span></div>
}

/**
 * Renders the saved receipt design through the shared renderer, so the preview
 * here, the designer canvas and the printed sheet can never drift apart.
 */
export function ReceiptPaper({ entry, design = {}, language, functionName = '', venue = '', organizer = '', className }) {
  const resolved = {
    language,
    fontSize: 16,
    alignment: 'center',
    border: 'double',
    borderWidth: 2,
    padding: 27,
    elements: [],
    ...design,
    ...(language ? { language } : {}),
  }
  // A function that has never been designed still prints a proper receipt.
  if (!resolved.elements?.length) {
    resolved.elements = normalizeReceiptDesign({ elements: templateById('classic').elements }).elements
  }
  return <ReceiptFrame
    className={cn(resolved.theme && `receipt-${resolved.theme.toLowerCase()}`, className)}
    design={resolved}
    entry={entry}
    functionName={functionName}
    venue={venue}
    organizer={organizer}
  />
}

export function SectionTitle({ title, titleTamil, description, descriptionTamil, trailing }) {
  const { uiLanguage } = useCeremony()
  return <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className={cn('text-lg font-semibold tracking-tight', uiLanguage === 'Tamil' && 'tamil-font')}>{localized(uiLanguage, title, titleTamil ?? title)}</h2>{description && <p className={cn('mt-1 text-sm text-muted-foreground', uiLanguage === 'Tamil' && 'tamil-font')}>{localized(uiLanguage, description, descriptionTamil ?? description)}</p>}</div>{trailing}</div>
}

export function PillToggle({ options, value, onChange, label }) {
  return <div className="inline-flex rounded-xl bg-secondary p-1" role="group" aria-label={label}>{options.map((option) => <button key={option} type="button" onClick={() => onChange(option)} aria-pressed={value === option} className={cn('min-h-[52px] rounded-lg px-3 text-sm font-semibold transition-colors', value === option ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{option}</button>)}</div>
}

export function BackButton({ href = '/' }) {
  const { uiLanguage } = useCeremony()
  return <Link to={href} className="secondary-action"><ArrowLeft className="size-4" />{localized(uiLanguage, 'Back', 'பின்செல்')}</Link>
}