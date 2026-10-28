import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CirclePlus, Gift, Printer, Sparkles, Wallet, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell, StatusBadge, Surface, UiText } from '@/components/ceremony/shared'
import { useCeremony, localized, formatRupees, paymentTotals, todayDate, todayISO, totalFor } from '@/components/ceremony-provider'
import { useAuth } from '@/contexts/AuthContext'
import { useDashboard } from '@/hooks/useDashboard'
import { paymentModes } from '@/components/ceremony/types'
import { cn } from '@/lib/utils'
import dashboardBackground from '@/images/dashboard.webp'
import cardBackground from '@/images/image.webp'
const modeTamil = { Cash: 'ரொக்கம்', UPI: 'யூபிஐ', Card: 'அட்டை', Other: 'மற்றவை' }

const occasionTamil = { Wedding: 'திருமணம்', Engagement: 'நிச்சயதார்த்தம்', Birthday: 'பிறந்தநாள்', Housewarming: 'புதுமனை புகுவிழா', Temple: 'கோவில் விழா', Anniversary: 'ஆண்டு விழா', Custom: 'தனிப்பயன்' }

export function DashboardScreen() {
  const { entries, functionDetails, scheduledFunctions, archivedFunctions, closeCollection, uiLanguage, status, error, refresh } = useCeremony()
  const { user } = useAuth()
  const { data: dashboard, loading: dashLoading, error: dashError } = useDashboard()
  const [showCloseSummary, setShowCloseSummary] = useState(false)
  const [showCreatePrompt, setShowCreatePrompt] = useState(false)
  const collectionClosed = archivedFunctions.some((item) => item.id === functionDetails?.id)
  const totals = paymentTotals(entries)
  const total = totalFor(entries)
  /** The target lives on the function; no goal is claimed until one is set. */
  const targetCollection = Number(functionDetails?.targetCollection) || 0
  const goalPercent = targetCollection > 0 ? Math.round((total / targetCollection) * 100) : 0
  const hasFunctionToday = Boolean(functionDetails?.id)
  const upcoming = scheduledFunctions.filter((item) => item.date >= todayISO())
  const displayName = (user?.displayName || user?.email || '').split('@')[0]

  useEffect(() => {
    // Only nag once the first load has finished, otherwise every new account
    // sees the create prompt flash before the request resolves.
    if (status === 'ready' && !hasFunctionToday) setShowCreatePrompt(true)
  }, [status, hasFunctionToday])

  useEffect(() => {
    if (!showCloseSummary && !showCreatePrompt) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCloseSummary(false)
        setShowCreatePrompt(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showCloseSummary, showCreatePrompt])

  function printReport() {
    document.body.classList.add('print-collection-report')
    window.addEventListener('afterprint', () => document.body.classList.remove('print-collection-report'), { once: true })
    window.print()
  }

  return <AppShell background={dashboardBackground}>
    <div className="flex flex-col gap-6">
      {hasFunctionToday ? (
        <section className="dashboard-hero dashboard-hero-compact hero-photo relative overflow-hidden rounded-[24px] px-5 py-5 text-white sm:px-6 sm:py-6" style={{ '--hero-photo': `url(${cardBackground})` }}>
          <div className="hero-orb hero-orb-one" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70">{todayDate()}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">வணக்கம், {displayName} <span className="font-normal text-white/75">· Vanakkam</span></h1>
            </div>
            <div className="hero-event-card hero-event-card-compact">
              <div className="flex items-center justify-between gap-3"><span className="eyebrow text-[#e4c879]">{localized(uiLanguage, "TODAY'S FUNCTION", 'இன்றைய நிகழ்ச்சி')}</span><StatusBadge status={collectionClosed ? 'Completed' : 'Active'} /></div>
              <h2 className="mt-2 truncate text-base font-semibold">{functionDetails.name}</h2>
              <p className={cn('mt-0.5 truncate text-xs text-white/65', uiLanguage === 'Tamil' && 'tamil-font')}>{uiLanguage === 'Tamil' && functionDetails.tamil ? functionDetails.tamil : localized(uiLanguage, functionDetails.type, occasionTamil[functionDetails.type] ?? functionDetails.type)} <span className="mx-1">·</span>{functionDetails.venue}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="no-function-card">
          <div className="no-function-icon"><CalendarDays /></div>
          <p className="eyebrow">{localized(uiLanguage, "TODAY'S COLLECTION", 'இன்றைய சேகரிப்பு')}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{localized(uiLanguage, 'No function today', 'இன்று நிகழ்ச்சி இல்லை')}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{localized(uiLanguage, 'Create a celebration to start collecting and printing thoughtful gift receipts.', 'பரிசுகளைச் சேகரித்து ரசீதுகளை அச்சிட ஒரு நிகழ்ச்சியை உருவாக்குங்கள்.')}</p>
          <Link to="/function-setup" className="primary-action mt-5"><CirclePlus className="size-4" /><DashboardLabel english="Set Up Function" tamil="நிகழ்ச்சியை அமைக்கவும்" /><ArrowRight className="size-4" /></Link>
        </section>
      )}

      <section aria-label={localized(uiLanguage, 'Collection summary', 'வசூல் சுருக்கம்')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Total Collection" tamil="மொத்த வசூல்" value={formatRupees(total)} detail={`${entries.length} gifts recorded`} detailTamil={`${entries.length} பரிசுகள் பதிவு செய்யப்பட்டன`} icon={<Wallet />} accent="green" trend={targetCollection > 0 ? localized(uiLanguage, `${goalPercent}% of goal achieved`, `இலக்கில் ${goalPercent}% நிறைவு`) : ''} />
        <SummaryCard label="Entries Count" tamil="பதிவுகளின் எண்ணிக்கை" value={String(entries.length)} detail="Across all payment modes" detailTamil="அனைத்து கட்டண முறைகளிலும்" icon={<Gift />} accent="gold" />
        <PaymentMixCard totals={totals} total={total} />
      </section>

      {/* Server-synced workspace summary */}
      {dashLoading ? (
        <Surface className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />{localized(uiLanguage, 'Loading workspace summary', 'பணியிட சுருக்கம் ஏற்றுக்கொள்ளப்படுகிறது')}</Surface>
      ) : dashboard ? (
        <Surface className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{localized(uiLanguage, "WORKSPACE", "பணியிடம்")}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{localized(uiLanguage, "Account overview", "கணக்கு கண்ணோட்டம்")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{localized(uiLanguage, 'Every function in your account — not just today\'s.', 'உங்கள் கணக்கிலுள்ள அனைத்து நிகழ்ச்சிகள் — இன்றையது மட்டும் அல்ல.')}</p>
            </div>
            <span className="status-badge status-active">{localized(uiLanguage, "Synced", "ஒத்திசைக்கப்பட்டது")}</span>
          </div>
          {/* Only account-scoped counts live here. Entries and Collection are
              already shown above for the active function, so repeating them as
              tiles read as duplicate metrics without indicating a wider scope. */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">{localized(uiLanguage, "Functions", "நிகழ்ச்சிகள்")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{dashboard.summary.totalFunctions}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">{localized(uiLanguage, "Workspaces", "பணியிடங்கள்")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{dashboard.summary.totalWorkspaces}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-secondary/40 p-3 sm:col-span-1">
              <p className="text-[11px] font-medium text-muted-foreground">{localized(uiLanguage, "Users", "பயனர்கள்")}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{dashboard.summary.totalUsers}</p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {localized(uiLanguage, 'Across every function', 'அனைத்து நிகழ்ச்சிகளிலும்')}:{' '}
            <span className="font-semibold text-foreground tabular-nums">{dashboard.summary.totalEntries}</span> {localized(uiLanguage, 'gifts', 'பரிசுகள்')} ·{' '}
            <span className="font-semibold text-foreground tabular-nums">{formatRupees(dashboard.summary.totalCollection)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{dashboard.user.displayName || dashboard.user.email}</span> · {dashboard.user.email}</span>
            <span className="capitalize">{localized(uiLanguage, "Role", "பங்கு")}: {dashboard.user.role}</span>
          </div>
        </Surface>
      ) : dashError ? (
        <Surface className="flex items-center gap-3 border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive"><span>!</span>{localized(uiLanguage, "Could not load server summary", "சுருக்கத்தை ஏற்ற முடியவில்லை")}: {dashError}</Surface>
      ) : null}

      <section aria-label={localized(uiLanguage, 'Quick actions', 'விரைவு செயல்கள்')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Primary collection action. It only existed in the header before, which
            is the one place it is easiest to miss on a long dashboard. */}
        {hasFunctionToday && <Link to="/collection" className="quick-action-card quick-action-card-primary"><span className="stat-icon stat-icon-green"><Gift /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold"><DashboardLabel english="Record a gift" tamil="பரிசைப் பதிவு செய்" /></span><span className="mt-1 block text-xs text-muted-foreground">{localized(uiLanguage, 'Add today’s entry and print the receipt', 'இன்றைய பதிவைச் சேர்த்து ரசீதை அச்சிக்கவும்')}</span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>}
        <Link to="/function-setup" className="quick-action-card"><span className="stat-icon stat-icon-gold"><Sparkles /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold"><DashboardLabel english="New Function Setup" tamil="புதிய நிகழ்ச்சி அமைப்பு" /></span><span className="mt-1 block text-xs text-muted-foreground">{localized(uiLanguage, 'Prepare another celebration', 'அடுத்த நிகழ்ச்சிக்குத் தயாராகுங்கள்')}</span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>
        <Link to="/receipt-preview" className="quick-action-card"><span className="stat-icon stat-icon-blue"><Printer /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold"><DashboardLabel english="Reprint Receipt" tamil="ரசீதை மீண்டும் அச்சிடு" /></span><span className="mt-1 block text-xs text-muted-foreground"><DashboardLabel english="Reprint the latest receipt" tamil="சமீபத்திய ரசீதை மீண்டும் அச்சிடு" /></span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link to="/entries-history" className="secondary-action">
          <UiText english="All entries" tamil="அனைத்து பதிவுகள்" />
          <ArrowRight className="size-4" />
        </Link>
        <button type="button" onClick={() => setShowCloseSummary(true)} disabled={collectionClosed} className="close-collection-button">
          <Check className="size-4" />
          <UiText english={collectionClosed ? 'Collection Closed' : 'Close Collection'} tamil={collectionClosed ? 'வசூல் முடிந்தது' : 'வசூலை முடிக்கவும்'} />
        </button>
      </div>

      {upcoming.length > 0 && <div className="schedule-nudge">
        <div className="flex items-start gap-3">
          <div className="function-icon"><CalendarDays className="size-4" /></div>
          <div>
            <h2 className="text-sm font-semibold"><UiText english="Upcoming schedules" tamil="வரவிருக்கும் திட்டங்கள்" /></h2>
            <p className="mt-1 text-xs text-muted-foreground"><UiText english={`${upcoming.length} function${upcoming.length === 1 ? '' : 's'} scheduled. Check the calendar to edit a setup or start collecting.`} tamil={`${upcoming.length} நிகழ்ச்சி திட்டமிடப்பட்டுள்ளது. அமைப்பைத் திருத்த அல்லது சேகரிப்பைத் தொடங்க நாட்காட்டியைப் பார்க்கவும்.`} /></p>
          </div>
        </div>
        <Link to="/calendar" className="secondary-action"><CalendarDays className="size-4" /><DashboardLabel english="Open calendar" tamil="நாட்காட்டியைத் திற" /><ArrowRight className="size-4" /></Link>
      </div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={refresh} className="secondary-action min-h-10 px-3 text-xs">{localized(uiLanguage, 'Try again', 'மீண்டும் முயற்சி')}</button></div>}
      <p className="pb-1 text-center text-xs text-muted-foreground">{dashboard?.user?.email ? `${dashboard.user.displayName || dashboard.user.email} · ${dashboard.user.email}` : localized(uiLanguage, 'Synced to your account', 'உங்கள் கணக்குடன் இணைக்கப்பட்டுள்ளது')}</p>
    </div>

    {showCloseSummary && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCloseSummary(false) }}><section role="dialog" aria-modal="true" aria-labelledby="close-summary-title" className="summary-dialog collection-report-print"><button type="button" onClick={() => setShowCloseSummary(false)} aria-label={localized(uiLanguage, 'Close summary', 'சுருக்கத்தை மூடு')} className="dialog-close"><X /></button><p className="eyebrow">{localized(uiLanguage, 'END OF DAY', 'நாளின் முடிவு')}</p><h2 id="close-summary-title" className="mt-2 text-2xl font-semibold">{localized(uiLanguage, 'Collection summary', 'வசூல் சுருக்கம்')}</h2><p className="mt-1 text-sm text-muted-foreground">{functionDetails.name}</p><div className="summary-total-block"><span>{localized(uiLanguage, 'Total collection', 'மொத்த வசூல்')}</span><strong>{formatRupees(total)}</strong><span>{entries.length} {localized(uiLanguage, 'entries', 'பதிவுகள்')}</span></div><div className="mt-5 flex flex-col divide-y divide-border">{paymentModes.map((item) => <div key={item} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2"><span className={`mix-dot mix-${item.toLowerCase()}`} />{localized(uiLanguage, item, modeTamil[item])}</span><strong className="tabular-nums">{formatRupees(totals[item])}</strong></div>)}</div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={printReport} className="secondary-action flex-1"><Printer className="size-4" /><DashboardLabel english="Print Report" tamil="அறிக்கையை அச்சிடு" /></button><button type="button" onClick={async () => { await closeCollection(functionDetails.id); setShowCloseSummary(false) }} className="primary-action flex-1"><Check className="size-4" /><DashboardLabel english="Close Collection" tamil="வசூலை முடிக்கவும்" /></button></div></section></div>}

    {showCreatePrompt && !hasFunctionToday && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="create-function-title" className="summary-dialog create-function-dialog"><button type="button" onClick={() => setShowCreatePrompt(false)} aria-label={localized(uiLanguage, 'Close', 'மூடு')} className="dialog-close"><X /></button><div className="no-function-icon"><CalendarDays /></div><p className="eyebrow mt-4">{localized(uiLanguage, 'WELCOME', 'வரவேற்கிறோம்')}</p><h2 id="create-function-title" className="mt-2 text-2xl font-semibold">{localized(uiLanguage, "Create today's function", 'இன்றைய நிகழ்ச்சியை உருவாக்குங்கள்')}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{localized(uiLanguage, 'Set up a function to begin collecting gifts and printing receipts.', 'பரிசுகளைச் சேகரித்து ரசீதுகளை அச்சிடத் தொடங்க ஒரு நிகழ்ச்சியை அமைக்கவும்.')}</p><Link to="/function-setup" className="primary-action mt-5 w-full"><CirclePlus className="size-4" /><DashboardLabel english="Set Up Function" tamil="நிகழ்ச்சியை அமைக்கவும்" /><ArrowRight className="size-4" /></Link></section></div>}
  </AppShell>
}

function DashboardLabel({ english, tamil }) {
  return <UiText english={english} tamil={tamil} />
}

function SummaryCard({ label, tamil, value, detail, detailTamil, icon, accent, trend }) {
  const { uiLanguage } = useCeremony()
  return <Surface className="p-5"><div className="flex items-start justify-between"><div className={`stat-icon stat-icon-${accent}`}>{icon}</div>{trend && <span className="goal-achievement-chip">{trend}</span>}</div><p className="mt-5 text-xs font-medium text-muted-foreground"><DashboardLabel english={label} tamil={tamil} /></p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{localized(uiLanguage, detail, detailTamil)}</p></Surface>
}

function PaymentMixCard({ totals, total }) {
  const { uiLanguage } = useCeremony()
  return <Surface className="p-5"><div className="flex items-start justify-between"><div className="stat-icon stat-icon-blue"><ArrowUpRight /></div><span className="mix-total-caption"><DashboardLabel english="Payment mix" tamil="கட்டணப் பிரிவு" /></span></div><p className="mt-5 text-xs font-medium text-muted-foreground"><DashboardLabel english="By payment mode" tamil="கட்டண முறையின்படி" /></p><div className="payment-mix-bar mt-3" role="img" aria-label={paymentModes.map((item) => `${localized(uiLanguage, item, modeTamil[item])} ${total ? Math.round(totals[item] / total * 100) : 0}%`).join(', ')}>
    {paymentModes.map((item) => <span key={item} className={`payment-mix-segment mix-${item.toLowerCase()}`} style={{ width: `${total ? totals[item] / total * 100 : 0}%` }} />)}
  </div><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">{paymentModes.map((item) => <div key={item} className="flex min-w-0 items-center gap-2 text-xs"><span className={`mix-dot mix-${item.toLowerCase()}`} /><span className="truncate text-muted-foreground">{localized(uiLanguage, item, modeTamil[item])}</span><strong className="ml-auto tabular-nums">{total ? Math.round(totals[item] / total * 100) : 0}%</strong></div>)}</div></Surface>
}