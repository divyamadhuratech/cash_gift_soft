import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Printer, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell, PageHeading, PillToggle, ReceiptPaper, Surface, UiText } from '@/components/ceremony/shared'
import { useCeremony, localized, backToCollectionLabel, formatRupees, printAgainLabel, printButtonLabel, receiptPreviewLabel, receiptSizeLabel, successEntryCopy } from '@/components/ceremony-provider'

export function ReceiptScreen() {
  const { selectedEntry, functionDetails, receiptDesign, uiLanguage } = useCeremony()
  const [language, setLanguage] = useState(receiptDesign.language)
  const entry = selectedEntry

  // Nothing recorded yet: the receipt is still previewable as a blank keepsake.
  const blankEntry = { name: '', amount: 0, mode: 'Cash', receipt: '', time: '', date: '' }

  return <AppShell>
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="A KEEPSAKE, MADE WITH CARE" eyebrowTamil="அன்புடன் உருவாக்கிய நினைவுப் பரிசு" title="Receipt preview" titleTamil="ரசீது முன்னோட்டம்" subtitle="A little note of gratitude for every generous blessing." subtitleTamil="ஒவ்வொரு அன்பளிப்பிற்கும் நன்றியுடன் ஒரு சிறு குறிப்பு." action={<Link to="/collection" className="secondary-action"><ArrowLeft className="size-4" /><UiText english="Back to Collection" tamil="சேகரிப்புக்குத் திரும்பு" /></Link>} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(370px,.85fr)]">
        <Surface className="p-5 sm:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="page-kicker"><Sparkles className="size-3.5" />{localized(uiLanguage, receiptPreviewLabel, 'நேரடி ரசீது முன்னோட்டம்')}</p>
              <h2 className="mt-2 text-lg font-semibold">{localized(uiLanguage, receiptSizeLabel, 'A6 ரசீது முன்னோட்டம்')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{entry
                ? `${localized(uiLanguage, 'Prepared for', 'பெறுநர்')} ${entry.name} · ${entry.receipt}`
                : localized(uiLanguage, 'No gift selected — showing a blank receipt.', 'பரிசு தேர்ந்தெடுக்கப்படவில்லை — காலியான ரசீது காட்டப்படுகிறது.')}</p>
            </div>
            <PillToggle options={['English', 'Tamil', 'Both']} value={language} onChange={setLanguage} label={localized(uiLanguage, 'Receipt language', 'ரசீது மொழி')} />
          </div>
          <div className="flex justify-center rounded-2xl bg-[#eeece3] p-4 sm:p-8">
            <ReceiptPaper
              entry={entry ?? blankEntry}
              design={receiptDesign}
              language={language}
              functionName={functionDetails?.name}
              venue={functionDetails?.venue}
              organizer={functionDetails?.organizer}
            />
          </div>
        </Surface>
        <div className="flex flex-col gap-5">
          <Surface className="p-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eaf3ec] text-[#31724b]"><CheckCircle2 className="size-5" /></span><div><h2 className="font-semibold">{entry ? localized(uiLanguage, 'Gift recorded with gratitude', 'பரிசு நன்றியுடன் பதிவு செய்யப்பட்டது') : localized(uiLanguage, 'Nothing recorded yet', 'இன்னும் எதுவும் பதிவு செய்யப்படவில்லை')}</h2><p className="mt-1 text-sm text-muted-foreground">{entry ? localized(uiLanguage, successEntryCopy, 'பதிவு சேமிக்கப்பட்டது. உங்கள் ரசீது அச்சிடத் தயாராக உள்ளது.') : localized(uiLanguage, 'Record a gift to see its receipt here.', 'இதன் ரசீதைக் காண ஒரு பரிசைப் பதிவு செய்யவும்.')}</p></div></div>
            {entry && <><div className="mt-6 rounded-xl bg-secondary/65 p-4"><p className="text-xs text-muted-foreground"><UiText english="Gift received" tamil="பெற்ற பரிசு" /></p><p className="mt-1 text-2xl font-semibold text-primary">{formatRupees(entry.amount)}</p><p className="mt-1 text-xs text-muted-foreground">{entry.mode} · {entry.time}</p></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground"><UiText english="Guest" tamil="விருந்தினர்" /></p><p className="mt-1 truncate text-sm font-semibold">{entry.name}</p></div><div><p className="text-xs text-muted-foreground"><UiText english="Receipt number" tamil="ரசீது எண்" /></p><p className="mt-1 font-mono text-sm font-semibold">{entry.receipt}</p></div></div></>}
            <button type="button" onClick={() => window.print()} className="primary-action mt-6 w-full"><Printer className="size-4" /><UiText english={printButtonLabel} tamil="அச்சிடு" /></button>
            <button type="button" onClick={() => window.print()} className="secondary-action mt-3 w-full"><UiText english={printAgainLabel} tamil="மீண்டும் அச்சிடு" /></button>
            <Link to="/collection" className="secondary-action mt-3 w-full"><UiText english={backToCollectionLabel} tamil="சேகரிப்புக்குத் திரும்பு" /></Link>
          </Surface>
          <div className="rounded-2xl border border-[#e8e1cf] bg-[#fbf8ef] p-5"><p className="text-sm font-semibold text-[#735d26]">{localized(uiLanguage, 'Print tip', 'அச்சிடும் குறிப்பு')}</p><p className="mt-1 text-xs leading-5 text-[#77705d]">{localized(uiLanguage, 'This receipt is formatted for A6 paper. Choose A6 in your printer settings for a keepsake-sized print.', 'இந்த ரசீது A6 காகித வடிவில் உள்ளது. நினைவுப் பரிசாக அச்சிட அச்சுப்பொறி அமைப்புகளில் A6-ஐத் தேர்ந்தெடுக்கவும்.')}</p></div>
        </div>
      </div>
    </div>
  </AppShell>
}