import { useState } from 'react'
import { Archive, CalendarDays, ChevronDown, MapPin, Printer, RotateCcw } from 'lucide-react'
import { AppShell, PageHeading, PaymentBadge, Surface, UiText } from '@/components/ceremony/shared'
import { formatRupees, formatScheduleDate, localized, useCeremony } from '@/components/ceremony-provider'
import { printEntriesReport, reportTotal } from '@/lib/entries-report'

export function CompletedScreen() {
  const { archivedFunctions, entriesByFunction, receiptDesignsByFunction, reopenCollection, uiLanguage } = useCeremony()
  const [openId, setOpenId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState('')

  async function reopen(id) {
    setActionError('')
    setBusyId(id)
    const result = await reopenCollection(id)
    setBusyId('')
    if (result.ok) {
      setOpenId('')
      return
    }
    setActionError(result.error)
  }

  const grandTotal = archivedFunctions.reduce((sum, item) => sum + (item.collectedTotal ?? 0), 0)
  const giftCount = archivedFunctions.reduce((sum, item) => sum + (item.entryCount ?? 0), 0)

  return <AppShell>
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="FUNCTION HISTORY"
        eyebrowTamil="நிகழ்ச்சி வரலாறு"
        title="Completed functions"
        titleTamil="நிறைவு நிகழ்ச்சிகள்"
        subtitle="Once a collection is closed it is archived here with its full report. Open a function to review and print its entries list."
        subtitleTamil="சேகரிப்பு மூடப்பட்டதும் அது முழு அறிக்கையுடன் இங்கே சேமிக்கப்படும். பதிவுப் பட்டியலைப் பார்க்க அல்லது அச்சிக்க நிகழ்ச்சியைத் திறக்கவும்."
      />

      {actionError && <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionError}</div>}

      {archivedFunctions.length === 0
        ? <Surface className="px-6 py-16 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><Archive /></span>
          <h2 className="mt-4 text-lg font-semibold">{localized(uiLanguage, 'No completed functions yet', 'இன்னும் நிறைவு நிகழ்ச்சிகள் இல்லை')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{localized(uiLanguage, 'When you close a collection from the dashboard, that function is archived here with its full report.', 'முகப்பிலிருந்து சேகரிப்பை மூடும்போது அந்த நிகழ்ச்சி முழு அறிக்கையுடன் இங்கே சேமிக்கப்படும்.')}</p>
        </Surface>
        : <>
          <section className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Completed functions" tamil="நிறைவு நிகழ்ச்சிகள்" value={String(archivedFunctions.length).padStart(2, '0')} />
            <SummaryTile label="Gifts archived" tamil="சேமிக்கப்பட்ட பரிசுகள்" value={String(giftCount).padStart(2, '0')} />
            <SummaryTile label="Total collected" tamil="மொத்த வசூல்" value={formatRupees(grandTotal)} />
          </section>

          <div className="flex flex-col gap-4">
            {archivedFunctions.map((item) => {
              const isOpen = openId === item.id
              const archivedEntries = entriesByFunction[item.id] ?? []
              return <Surface key={item.id} className="overflow-hidden">
                <button type="button" onClick={() => setOpenId(isOpen ? '' : item.id)} aria-expanded={isOpen} className="flex w-full flex-wrap items-center gap-4 p-5 text-left sm:p-6">
                  <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#f3efe1] leading-none text-[#907333] dark:bg-secondary">
                    <span className="text-[9px] font-bold uppercase">{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span>
                    <span className="text-xl font-bold">{new Date(`${item.date}T00:00:00`).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold">{item.name}</h2>
                    {item.tamil && <p className="tamil-font mt-0.5 truncate text-xs text-muted-foreground">{item.tamil}</p>}
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatScheduleDate(item.date)}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="size-3.5" />{item.venue}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums">{formatRupees(item.collectedTotal ?? 0)}</p>
                      <p className="text-[11px] text-muted-foreground">{item.entryCount ?? 0} {localized(uiLanguage, 'gifts', 'பரிசுகள்')}</p>
                    </div>
                    <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && <div className="border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-3 text-xs text-muted-foreground sm:px-6">
                    <span>{localized(uiLanguage, `Collection closed ${new Date(item.closedAt).toLocaleString('en-IN')}`, `சேகரிப்பு ${new Date(item.closedAt).toLocaleString('en-IN')} மூடப்பட்டது`)}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => printEntriesReport({ functionName: item.name, venue: item.venue, organizer: item.organizer, entries: archivedEntries, design: receiptDesignsByFunction[item.id]?.entriesDesign ?? {}, subtitle: 'Closed collection report', footnote: `${item.venue} · closed ${new Date(item.closedAt).toLocaleDateString('en-IN')}` })} className="secondary-action min-h-11 px-3 text-xs"><Printer className="size-4" /><UiText english="Print report" tamil="அறிக்கையை அச்சிடு" /></button>
                      <button type="button" onClick={() => reopen(item.id)} disabled={busyId === item.id} className="secondary-action min-h-11 px-3 text-xs disabled:opacity-50"><RotateCcw className="size-4" /><UiText english={busyId === item.id ? 'Reopening…' : 'Reopen'} tamil={busyId === item.id ? 'திறக்கிறது…' : 'மீண்டும் திற'} /></button>
                    </div>
                  </div>
                  {archivedEntries.length === 0
                    ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">{localized(uiLanguage, 'No gifts were recorded for this function.', 'இந்த நிகழ்ச்சிக்கு எந்த பரிசும் பதிவு செய்யப்படவில்லை.')}</p>
                    : <div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th><UiText english="Guest" tamil="விருந்தினர்" /></th><th><UiText english="Amount" tamil="தொகை" /></th><th><UiText english="Payment" tamil="கட்டண முறை" /></th><th><UiText english="Receipt" tamil="ரசீது எண்" /></th><th><UiText english="City / Relation" tamil="நகரம் / உறவு" /></th></tr></thead><tbody>{archivedEntries.map((entry) => <tr key={entry.receipt}><td><div className="font-semibold">{entry.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{entry.giftType ?? 'Gift'}</div></td><td className="font-semibold tabular-nums">{formatRupees(entry.amount)}</td><td><PaymentBadge mode={entry.mode} /></td><td className="font-mono text-xs text-muted-foreground">{entry.receipt}</td><td><div className="text-sm">{entry.city || '—'}</div><div className="mt-0.5 text-xs text-muted-foreground">{entry.relation || '—'}</div></td></tr>)}</tbody><tfoot><tr><th><UiText english="Total" tamil="மொத்தம்" /></th><th>{formatRupees(reportTotal(archivedEntries))}</th><th colSpan={3} /></tr></tfoot></table></div>}
                </div>}
              </Surface>
            })}
          </div>
        </>}
    </div>
  </AppShell>
}

function SummaryTile({ label, tamil, value }) {
  return <Surface className="p-5"><p className="text-xs text-muted-foreground"><UiText english={label} tamil={tamil} /></p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></Surface>
}