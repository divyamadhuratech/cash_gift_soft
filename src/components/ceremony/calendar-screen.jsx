import { useMemo, useState } from 'react'
import { Archive, CalendarDays, ChevronLeft, ChevronRight, CirclePlus, MapPin, PencilLine, PlayCircle } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageHeading, StatusBadge, Surface, UiText } from '@/components/ceremony/shared'
import { formatScheduleDate, localized, monthKey, statusForDate, todayISO, useCeremony } from '@/components/ceremony-provider'
import { cn } from '@/lib/utils'

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const weekdayTamil = ['திங்கடி', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி', 'ஞாயிறு']
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthNamesTamil = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்']

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const leading = (first.getDay() + 6) % 7
  const days = []
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, month, index - leading + 1)
    days.push({ iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, day: date.getDate(), inMonth: date.getMonth() === month })
  }
  return days
}

export function CalendarScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { scheduledFunctions, startCollection, uiLanguage } = useCeremony()
  const today = new Date(`${todayISO()}T00:00:00`)
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDate, setSelectedDate] = useState('')
  const [scope, setScope] = useState('upcoming')
  // Setup hands its "saved, but not opened" explanation over here.
  const [switchError, setSwitchError] = useState(location.state?.notice ?? '')

  const functionsByDate = useMemo(() => scheduledFunctions.reduce((grouped, item) => {
    if (!grouped[item.date]) grouped[item.date] = []
    grouped[item.date].push(item)
    return grouped
  }, {}), [scheduledFunctions])

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view])
  const visibleMonthKey = monthKey(view.year, view.month)
  const now = todayISO()

  const visible = useMemo(() => scheduledFunctions
    .filter((item) => {
      if (scope === 'upcoming') return item.date >= now && item.status !== 'Completed'
      if (scope === 'month') return item.date?.startsWith(visibleMonthKey) && item.status !== 'Completed'
      if (scope === 'past') return item.date < now || item.status === 'Completed'
      if (scope === 'all') return true
      return item.date === selectedDate
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')), [scheduledFunctions, scope, visibleMonthKey, selectedDate, now])

  const upcomingCount = scheduledFunctions.filter((item) => item.date >= now).length

  /**
   * Switching is refused while another collection is open, so only navigate
   * once the switch actually succeeded and otherwise show why it did not.
   */
  async function openCollection(id) {
    setSwitchError('')
    const result = await startCollection(id)
    if (result.ok) {
      navigate('/collection')
      return
    }
    setSwitchError(result.error ?? 'Could not open that collection.')
  }

  function shiftMonth(delta) {
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  return <AppShell>
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="UPCOMING SCHEDULES"
        eyebrowTamil="வரவிருக்கும் நிகழ்ச்சிகள்"
        title="Function calendar"
        titleTamil="நிகழ்ச்சி நாட்காட்டி"
        subtitle="Pick a date to see which celebrations are scheduled. Open a function to edit its setup, or start collecting right away."
        subtitleTamil="எந்த நாளில் என்ன நிகழ்ச்சி என்பதைப் பார்க்க தேதியைத் தேர்ந்தெடுக்கவும். அமைப்பைத் திருத்த அல்லது சேகரிப்பைத் தொடங்க நிகழ்ச்சியைத் திறக்கவும்."
        action={<div className="flex flex-wrap gap-2"><Link to="/completed" className="secondary-action"><Archive className="size-4" /><UiText english="Completed" tamil="நிறைவு" /></Link><Link to="/function-setup" className="primary-action"><CirclePlus className="size-4" /><UiText english="New function setup" tamil="புதிய நிகழ்ச்சி அமைப்பு" /></Link></div>}
      />

      {switchError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{switchError}</span>
          <button type="button" onClick={() => setSwitchError('')} className="secondary-action min-h-10 px-3 text-xs">
            <UiText english="Dismiss" tamil="மூடு" />
          </button>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <Surface className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{localized(uiLanguage, 'Month view', 'மாத முறை')}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">{localized(uiLanguage, `${monthNames[view.month]} ${view.year}`, `${monthNamesTamil[view.month]} ${view.year}`)}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => shiftMonth(-1)} className="icon-button" aria-label={localized(uiLanguage, 'Previous month', 'முந்தைய மாதம்')}><ChevronLeft /></button>
              <button type="button" onClick={() => { setView({ year: today.getFullYear(), month: today.getMonth() }); setSelectedDate(todayISO()); setScope('date') }} className="secondary-action">{localized(uiLanguage, 'Today', 'இன்று')}</button>
              <button type="button" onClick={() => shiftMonth(1)} className="icon-button" aria-label={localized(uiLanguage, 'Next month', 'அடுத்த மாதம்')}><ChevronRight /></button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1.5">
            {weekdayLabels.map((label, index) => <span key={label} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground" title={localized(uiLanguage, label, weekdayTamil[index])}>{label.slice(0, 1)}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {grid.map((cell) => {
              const dayFunctions = functionsByDate[cell.iso] ?? []
              const isToday = cell.iso === todayISO()
              const isPicked = cell.iso === selectedDate
              return <button
                key={cell.iso}
                type="button"
                onClick={() => { setSelectedDate(cell.iso); setScope('date') }}
                aria-label={`${formatScheduleDate(cell.iso)}${dayFunctions.length ? ` — ${dayFunctions.map((item) => item.name).join(', ')}` : ''}`}
                aria-pressed={isPicked}
                className={cn(
                  'flex min-h-[62px] flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition',
                  cell.inMonth ? 'border-border bg-card hover:border-primary/50' : 'border-transparent bg-secondary/30 text-muted-foreground/60',
                  isToday && 'border-primary ring-1 ring-primary/25',
                  isPicked && 'bg-primary/8 ring-2 ring-primary/35',
                )}
              >
                <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px] font-bold', isToday ? 'bg-primary text-primary-foreground' : '')}>{cell.day}</span>
                {dayFunctions.slice(0, 2).map((item) => <span key={item.id} className={cn('w-full truncate rounded px-1 py-0.5 text-[10px] font-semibold', item.status === 'Completed' ? 'bg-secondary text-muted-foreground' : 'bg-primary/12 text-primary')}>{item.name}</span>)}
                {dayFunctions.length > 2 && <span className="px-1 text-[10px] font-semibold text-muted-foreground">+{dayFunctions.length - 2} more</span>}
              </button>
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{localized(uiLanguage, 'Select any day to filter the schedule list.', 'பட்டியலை வடிகட்ட எந்த நாளையும் தேர்ந்தெடுக்கவும்.')}</p>
        </Surface>

        <div className="flex flex-col gap-4 lg:sticky lg:top-40">
          <Surface className="p-5">
            <label className="form-label" htmlFor="calendar-date-picker"><UiText english="Filter by date" tamil="தேதி வடிகட்டு" /></label>
            <input id="calendar-date-picker" type="date" className="form-input" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setScope('date') }} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[['upcoming', 'Upcoming', 'வரவிருக்கிறது'], ['month', 'This month', 'இந்த மாதம்'], ['past', 'Past', 'கடந்தவை'], ['all', 'All dates', 'அனைத்து தேதிகள்']].map(([key, label, tamil]) => (
                <button key={key} type="button" onClick={() => setScope(key)} aria-pressed={scope === key} className={cn('min-h-11 rounded-xl border px-3 text-xs font-semibold transition', scope === key ? 'border-primary bg-primary/8 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>{localized(uiLanguage, label, tamil)}</button>
              ))}
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight"><UiText english="Scheduled functions" tamil="திட்டமிடப்பட்ட நிகழ்ச்சிகள்" /></h2>
                <p className="mt-1 text-sm text-muted-foreground">{visible.length} {localized(uiLanguage, 'showing', 'காட்டப்படுகிறது')} · {upcomingCount} {localized(uiLanguage, 'upcoming', 'வரவிருக்கிறது')}</p>
              </div>
            </div>

            {visible.length === 0
              ? <div className="rounded-2xl border border-dashed border-border p-6 text-center"><CalendarDays className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">{localized(uiLanguage, 'Nothing scheduled here', 'இங்கு எதுவும் திட்டமிடப்படவில்லை')}</p><p className="mt-1 text-xs text-muted-foreground">{localized(uiLanguage, 'Try another date, or set up a new function.', 'வேறு தேதியை முயற்சிக்கவும் அல்லது புதிய நிகழ்ச்சியை அமைக்கவும்.')}</p></div>
              : <div className="flex flex-col divide-y divide-border">{visible.map((item) => <article key={item.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#f3efe1] leading-none text-[#907333] dark:bg-secondary">
                    <span className="text-[9px] font-bold uppercase">{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                    <span className="text-base font-bold">{new Date(`${item.date}T00:00:00`).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{item.name}</h3><StatusBadge status={statusForDate(item.date)} /></div>
                    {item.tamil && <p className="tamil-font mt-1 text-xs text-muted-foreground">{item.tamil}</p>}
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" />{item.venue}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-0 sm:pl-15">
                  <button type="button" onClick={() => openCollection(item.id)} className="primary-action min-h-11 flex-1 px-3 text-xs"><PlayCircle className="size-4" />{localized(uiLanguage, 'Start collection', 'சேகரிப்பைத் தொடங்கு')}</button>
                  <Link to={`/function-setup?edit=${item.id}`} className="secondary-action min-h-11 flex-1 px-3 text-xs"><PencilLine className="size-4" />{localized(uiLanguage, 'Edit setup', 'அமைப்பைத் திருத்து')}</Link>
                </div>
              </article>)}</div>}
          </Surface>
        </div>
      </div>
    </div>
  </AppShell>
}