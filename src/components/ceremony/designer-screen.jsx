import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AppShell, PageHeading, Surface, UiText } from '@/components/ceremony/shared'
import { ReceiptDesigner } from '@/components/ceremony/receipt-designer'
import { templateById } from '@/lib/design-templates'
import { useCeremony, normalizeReceiptDesign, defaultReceiptDesign } from '@/components/ceremony-provider'

/** Falls back to the Classic template the first time a function is designed. */
function withElements(design) {
  const normalized = normalizeReceiptDesign(design)
  if (normalized.elements.length) return normalized
  const template = templateById(normalized.template ?? 'classic')
  return {
    ...normalized,
    template: template.name,
    accent: normalized.accent || template.accent,
    border: normalized.border || template.border,
    borderColor: normalized.borderColor || template.accent,
    fontSize: normalized.fontSize || template.fontSize,
    alignment: normalized.alignment || template.alignment,
    elements: normalizeReceiptDesign({ elements: template.elements }).elements,
  }
}

export function DesignerScreen() {
  const [searchParams] = useSearchParams()
  const target = searchParams.get('fn')
  const resumeMode = searchParams.get('mode')
  const { scheduledFunctions, startCollection, activeFunctionId, selectedEntry, entries, functionDetails, receiptDesign, saveReceiptDesign, uiLanguage } = useCeremony()
  const targetRecord = target ? scheduledFunctions.find((item) => item.id === target) : undefined
  const needsSwitch = Boolean(targetRecord && targetRecord.id !== activeFunctionId)

  const [design, setDesign] = useState(() => withElements(receiptDesign))
  /**
   * The designer saves to whatever function is active, so designing a
   * different one must switch first. While a collection is in progress that
   * switch is refused — rendering anyway would save the new design onto the
   * wrong function — so wait, then show the reason instead of the canvas.
   */
  const [switchState, setSwitchState] = useState(needsSwitch ? 'pending' : 'idle')
  const [switchNotice, setSwitchNotice] = useState('')

  useEffect(() => {
    let alive = true
    if (!targetRecord || targetRecord.id === activeFunctionId) {
      setSwitchState('idle')
      return () => { alive = false }
    }
    setSwitchState('pending')
    startCollection(targetRecord.id).then((result) => {
      if (!alive) return
      setSwitchState(result.ok ? 'idle' : 'blocked')
      setSwitchNotice(result.ok ? '' : (result.error ?? 'Could not open that collection.'))
    })
    return () => { alive = false }
  }, [targetRecord, activeFunctionId, startCollection])

  useEffect(() => {
    setDesign(withElements(receiptDesign))
  }, [receiptDesign])

  const entry = useMemo(() => selectedEntry ?? entries[0] ?? null, [selectedEntry, entries])

  if (!target || !functionDetails) return <Navigate to="/function-setup" replace />

  if (switchState === 'blocked') {
    return <AppShell>
      <Surface className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-lg font-semibold">This function is not the open collection</h1>
        <p className="mt-2 text-sm text-muted-foreground">{switchNotice}</p>
        <p className="mt-2 text-sm text-muted-foreground">Close the current collection first, then open this function from the calendar to design its receipt.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link to="/calendar" className="primary-action"><ArrowLeft className="size-4" /><UiText english="Back to calendar" tamil="நாட்காட்டிக்கு" /></Link>
        </div>
      </Surface>
    </AppShell>
  }

  if (switchState === 'pending') {
    return <AppShell>
      <Surface className="mx-auto max-w-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">Opening {targetRecord?.name ?? 'this function'}…</p>
      </Surface>
    </AppShell>
  }

  return <AppShell>
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="MAKE IT YOURS"
        eyebrowTamil="உங்களுக்கான வடிவமைப்பு"
        title="Receipt designer"
        titleTamil="ரசீது வடிவமைப்பு"
        subtitle="Start from a template, then tune every line, colour and border on the live canvas."
        subtitleTamil="வார்ப்புருவிலிருந்து தொடங்கி, ஒவ்வொரு வரியையும் நிறத்தையும் கிடிவெல்லையும் நேரடி விளக்கப்படத்தில் அமைக்கவும்."
        action={<Link to={`/function-setup?edit=${target}${resumeMode ? `&mode=${resumeMode}` : ''}`} className="secondary-action"><ArrowLeft className="size-4" /><UiText english="Back to setup" tamil="அமைப்புக்குத் திரும்பு" /></Link>}
      />
      <Surface className="p-3 sm:p-4">
        <ReceiptDesigner
          design={design}
          onChange={(next) => setDesign({ ...next, elements: (next.elements ?? []).map((element, order) => ({ ...element, order })) })}
          onSave={() => saveReceiptDesign({ ...design, theme: design.theme ?? defaultReceiptDesign.theme })}
          functionName={functionDetails.name}
          venue={functionDetails.venue}
          organizer={functionDetails.organizer}
          entry={entry}
          uiLanguage={uiLanguage}
        />
      </Surface>
    </div>
  </AppShell>
}

export default DesignerScreen
