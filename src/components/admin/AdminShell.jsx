import { Link, useLocation } from "react-router-dom"
import { useCeremony, localized, logoWord, appTagline } from "@/components/ceremony-provider"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { LogOut, Moon, Sun, ShieldCheck } from "lucide-react"

export function AdminShell({ children }) {
  const { pathname } = useLocation()
  const { isDark, toggleDark, uiLanguage, setUiLanguage } = useCeremony()
  const { user, logout } = useAuth()

  const nav = [
    { english: "Overview", tamil: "முகப்பு", to: "/admin" },
    { english: "Users", tamil: "பயனர்கள்", to: "/admin/users" },
    { english: "Workspaces", tamil: "பணியிடங்கள்", to: "/admin/workspaces" },
    { english: "Settings", tamil: "அமைப்புகள்", to: "/admin/settings" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="app-topbar sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-7">
            <Link to="/admin" aria-label={localized(uiLanguage, 'Admin dashboard', 'நிர்வாக முகப்பு')} className="flex items-center gap-2.5">
              <span className="brand-mark brand-mark-inverse"><ShieldCheck className="size-4" /></span>
              <span className="flex flex-col leading-none">
                <span className="brand-word">{logoWord}</span>
                <span className="mt-1 hidden text-[10px] tracking-[0.12em] text-muted-foreground sm:block">{appTagline}</span>
              </span>
            </Link>
            <div className="hidden h-9 w-px bg-border lg:block" />
            <nav aria-label={localized(uiLanguage, 'Admin navigation', 'நிர்வாக வழிசெலுத்தல்')} className="hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={cn('nav-link', pathname === item.to && 'nav-link-active')}>
                  {localized(uiLanguage, item.english, item.tamil)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={toggleDark} aria-label={isDark ? localized(uiLanguage, 'Switch to light mode', 'ஒளி பயன்முறைக்கு மாறவும்') : localized(uiLanguage, 'Switch to dark mode', 'இருள் பயன்முறைக்கு மாறவும்')} className="icon-button hidden sm:inline-flex">{isDark ? <Sun /> : <Moon />}</button>
            <div className="language-toggle language-toggle-desktop" role="group" aria-label={localized(uiLanguage, 'Dashboard language', 'டாஷ்போர்டு மொழி')}>
              <button type="button" onClick={() => setUiLanguage('English')} aria-pressed={uiLanguage === 'English'} className={cn('language-toggle-option', uiLanguage === 'English' && 'language-toggle-option-active')}>EN</button>
              <span aria-hidden="true" className="language-toggle-divider">|</span>
              <button type="button" onClick={() => setUiLanguage('Tamil')} aria-pressed={uiLanguage === 'Tamil'} className={cn('language-toggle-option tamil-font', uiLanguage === 'Tamil' && 'language-toggle-option-active')}>தமிழ்</button>
            </div>
            <div className="profile-avatar" aria-label={`${user?.displayName || user?.email}, ${localized(uiLanguage, 'Administrator', 'நிர்வாகி')}`} title={user?.displayName || user?.email}>{(user?.displayName || user?.email || 'A').slice(0, 2).toUpperCase()}</div>
            <button type="button" onClick={logout} aria-label={localized(uiLanguage, 'Sign out', 'புறந்துவிடு')} className="icon-button" title={localized(uiLanguage, 'Sign out', 'புறந்துவிடு')}><LogOut className="size-4" /></button>
          </div>
        </div>
        <div className="mobile-nav lg:hidden" aria-label={localized(uiLanguage, 'Admin navigation', 'நிர்வாக வழிசெலுத்தல்')}>
          {nav.map((item) => (
            <Link key={item.to} to={item.to} aria-current={pathname === item.to ? 'page' : undefined} className={cn('mobile-nav-link', pathname === item.to && 'mobile-nav-link-active')}>
              {localized(uiLanguage, item.english, item.tamil)}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">{children}</main>
    </div>
  )
}

export default AdminShell