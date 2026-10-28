import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Eye, FileDown, FilePenLine, Printer, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell, PageHeading, PaymentBadge, SectionTitle, Surface, UiText } from '@/components/ceremony/shared'
import { useCeremony, localized, dateFilterOptions, exportCsv, formatRupees, minimumAmountLabel, noEntriesHint, tableEmptyMessage, todayDate, todayISO } from '@/components/ceremony-provider'
import { paymentModes } from '@/components/ceremony/types'
import { printEntriesReport as printReport } from '@/lib/entries-report'

const dateTamil = { 'All dates': 'அனைத்து தேதிகள்', Today: 'இன்று', 'Last 7 days': 'கடந்த 7 நாட்கள்', 'This month': 'இந்த மாதம்' }
const modeTamil = { Cash: 'ரொக்கம்', UPI: 'யூபிஐ', Card: 'அட்டை', Other: 'மற்றவை' }

export function HistoryScreen() {
  const navigate = useNavigate()
  const { entries, setSelectedEntry, functionDetails, uiLanguage, receiptDesign } = useCeremony()
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('All dates')
  const [mode, setMode] = useState('All modes')
  const [minimum, setMinimum] = useState('')
  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesText = `${entry.name} ${entry.receipt} ${entry.city ?? ''}`.toLowerCase().includes(query.toLowerCase())
    const matchesMode = mode === 'All modes' || entry.mode === mode
    const matchesAmount = entry.amount >= (Number(minimum) || 0)
    const eventDate = new Date(`${functionDetails?.date || todayISO()}T00:00:00`)
    const entryDate = new Date(`${entry.date ?? functionDetails?.date ?? todayISO()}T00:00:00`)
    const sameDay = entryDate.toDateString() === eventDate.toDateString()
    const withinWeek = entryDate >= new Date(eventDate.getTime() - 6 * 24 * 60 * 60 * 1000) && entryDate <= eventDate
    const sameMonth = entryDate.getFullYear() === eventDate.getFullYear() && entryDate.getMonth() === eventDate.getMonth()
    const matchesDate = date === 'All dates' || (date === 'Today' && sameDay) || (date === 'Last 7 days' && withinWeek) || (date === 'This month' && sameMonth)
    return matchesText && matchesMode && matchesAmount && matchesDate
  }), [entries, query, mode, minimum, date, functionDetails?.date])
  const clearFilters = () => {
    setQuery('')
    setDate('All dates')
    setMode('All modes')
    setMinimum('')
  }

  function printEntriesReport() {
    printReport({
      functionName: functionDetails?.name ?? '',
      venue: functionDetails?.venue ?? '',
      organizer: functionDetails?.organizer ?? '',
      entries: filtered,
      design: receiptDesign.entriesDesign ?? {},
    })
  }

  function openReceipt(entry) {
    setSelectedEntry(entry)
    navigate('/receipt-preview')
  }

  return <AppShell>
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="EVERY BLESSING, ONE RECORD" eyebrowTamil="ஒவ்வொரு பரிசும் ஒரு பதிவில்" title="Entries history" titleTamil="பதிவுகள் வரலாறு" subtitle="Review entries and export the filtered collection as a designed A4 table or CSV." subtitleTamil="பதிவுகளைப் பார்த்து, வடிவமைக்கப்பட்ட A4 அட்டவணையாக அல்லது CSV ஆக ஏற்றுமதி செய்யவும்." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={printEntriesReport} className="secondary-action"><Printer className="size-4" /><UiText english="Export A4 table" tamil="A4 அட்டவணையை ஏற்றுமதி செய்" /></button><button type="button" onClick={() => exportCsv(filtered)} disabled={!filtered.length} className="secondary-action disabled:opacity-50"><FileDown className="size-4" /><UiText english="Export CSV" tamil="CSV ஏற்றுமதி" /></button></div>} />
      <section className="grid gap-4 sm:grid-cols-3"><HistoryStat title="Total gifts" titleTamil="மொத்த பரிசுகள்" value={String(entries.length).padStart(2, '0')} sub="Saved to your account" subTamil="உங்கள் கணக்கில் சேமிக்கப்பட்டவை" /><HistoryStat title="Total collection" titleTamil="மொத்த வசூல்" value={formatRupees(entries.reduce((sum, entry) => sum + entry.amount, 0))} sub={`As of ${todayDate()}`} subTamil={`${todayDate()} நிலவரப்படி`} /><HistoryStat title="Filtered results" titleTamil="வடிகட்டிய முடிவுகள்" value={String(filtered.length).padStart(2, '0')} sub="Matching your filters" subTamil="உங்கள் வடிகட்டிகளுடன் பொருந்துபவை" /></section>
      <Surface className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start sm:p-6"><SectionTitle title="All gifts" titleTamil="அனைத்து பரிசுகள்" description="Search by guest, receipt number, or city." descriptionTamil="விருந்தினர், ரசீது எண் அல்லது நகரத்தின் மூலம் தேடுங்கள்." trailing={<SlidersHorizontal className="size-4 text-muted-foreground" />} /><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">{filtered.length} {localized(uiLanguage, 'entries', 'பதிவுகள்')}</span></div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(135px,.65fr))_auto]">
          <label className="search-control"><Search className="size-4 shrink-0 text-muted-foreground" /><span className="sr-only">{localized(uiLanguage, 'Search entries', 'பதிவுகளைத் தேடுங்கள்')}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localized(uiLanguage, 'Search guests or receipt no.', 'விருந்தினர் அல்லது ரசீது எண்ணைத் தேடுங்கள்')} /></label>
          <label className="flex flex-col gap-1"><span className="sr-only">{localized(uiLanguage, 'Filter by date', 'தேதி அடிப்படையில் வடிகட்டுங்கள்')}</span><select className="select-control" value={date} onChange={(event) => setDate(event.target.value)}>{dateFilterOptions.map((item) => <option key={item}>{localized(uiLanguage, item, dateTamil[item] ?? item)}</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className="sr-only">{localized(uiLanguage, 'Filter by payment mode', 'கட்டண முறையின்படி வடிகட்டுங்கள்')}</span><select className="select-control" value={mode} onChange={(event) => setMode(event.target.value)}><option>{localized(uiLanguage, 'All modes', 'அனைத்து முறைகள்')}</option>{paymentModes.map((item) => <option key={item}>{localized(uiLanguage, item, modeTamil[item])}</option>)}</select></label>
          <label className="text-control"><span className="shrink-0 text-xs text-muted-foreground">{localized(uiLanguage, 'Min ₹', 'குறைந்தபட்சம் ₹')}</span><input type="number" min="0" inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="0" aria-label={localized(uiLanguage, minimumAmountLabel, 'குறைந்தபட்சத் தொகை')} /></label>
          <button type="button" onClick={clearFilters} className="secondary-action min-h-12 px-3 text-xs"><X className="size-4" /><UiText english="Clear" tamil="அழி" /></button>
        </div>
        <div className="flex items-center gap-2 border-y border-border bg-secondary/35 px-5 py-3 text-xs text-muted-foreground sm:px-6"><CalendarDays className="size-3.5" />{localized(uiLanguage, `Showing ${date.toLowerCase()}`, `${date === 'Today' ? 'இன்றைய' : 'தேர்ந்தெடுத்த'} பதிவுகள்`)} <span className="text-border">·</span> {localized(uiLanguage, 'Date filters are based on the current function.', 'தேதி வடிகட்டிகள் தற்போதைய நிகழ்ச்சியை அடிப்படையாகக் கொண்டவை.')}</div>
        {filtered.length ? <div className="overflow-x-auto"><table className="data-table min-w-[900px]"><thead><tr><th><UiText english="Guest Name" tamil="விருந்தினர்" /></th><th><UiText english="Amount" tamil="தொகை" /></th><th><UiText english="Payment Mode" tamil="கட்டண முறை" /></th><th><UiText english="Time" tamil="நேரம்" /></th><th><UiText english="Receipt No." tamil="ரசீது எண்" /></th><th><UiText english="City / Relation" tamil="நகரம் / உறவு" /></th><th className="text-right"><UiText english="Actions" tamil="செயல்கள்" /></th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.receipt}><td><div className="font-semibold">{entry.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{entry.giftType ?? 'Gift'}</div></td><td className="font-semibold tabular-nums">{formatRupees(entry.amount)}</td><td><PaymentBadge mode={entry.mode} /></td><td className="text-muted-foreground">{entry.time}</td><td className="font-mono text-xs text-muted-foreground">{entry.receipt}</td><td><div className="text-sm">{entry.city || '—'}</div><div className="mt-0.5 text-xs text-muted-foreground">{entry.relation || '—'}</div></td><td><div className="flex justify-end gap-1"><button type="button" onClick={() => openReceipt(entry)} title="View receipt" aria-label={`View receipt for ${entry.name}`} className="row-action"><Eye className="size-4" /></button><button type="button" onClick={() => openReceipt(entry)} title="Reprint receipt" aria-label={`Reprint receipt for ${entry.name}`} className="row-action"><Printer className="size-4" /></button><button type="button" onClick={() => { setSelectedEntry(entry); navigate(`/collection?edit=${encodeURIComponent(entry.receipt)}`) }} title="Edit entry" aria-label={`Edit ${entry.name}`} className="row-action"><FilePenLine className="size-4" /></button></div></td></tr>)}</tbody></table></div> : <div className="px-5 py-16 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><Search className="size-5" /></span><h3 className="mt-4 font-semibold">No entries found</h3><p className="mt-1 text-sm text-muted-foreground">{tableEmptyMessage}</p><button type="button" onClick={clearFilters} className="text-link mx-auto mt-4">Clear filters <ArrowRight className="size-4" /></button></div>}
        <div className="flex flex-col justify-between gap-2 border-t border-border px-5 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6"><span>{localized(uiLanguage, noEntriesHint, 'அனைத்து பரிசுகளையும் காண தேடல் அல்லது கட்டண வடிகட்டியை மாற்றவும்.')}</span><span>{filtered.length} / {entries.length} {localized(uiLanguage, 'entries', 'பதிவுகள்')}</span></div>
      </Surface>
      <div className="flex justify-center"><Link to="/collection" className="text-link"><UiText english="Record a new gift" tamil="புதிய பரிசைப் பதிவு செய்" /><ArrowRight className="size-4" /></Link></div>
    </div>
  </AppShell>
}

function HistoryStat({ title, titleTamil, value, sub, subTamil }) {
  return <Surface className="p-5"><p className="text-xs text-muted-foreground"><UiText english={title} tamil={titleTamil} /></p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground"><UiText english={sub} tamil={subTamil} /></p></Surface>
}

