import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, GripVertical, ImagePlus, Palette, Plus, Printer, Trash2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell, PageHeading, Surface, UiText } from '@/components/ceremony/shared'
import { DetailFieldInput } from '@/components/ceremony/detail-field-input'
import { FieldManager } from '@/components/ceremony/field-manager'
import { ReceiptDesigner } from '@/components/ceremony/receipt-designer'
import { BORDER_STYLES, borderCss, normalizeHex } from '@/lib/border-styles'
import { buildEntriesReportHtml, printEntriesReport } from '@/lib/entries-report'
import { uploadsApi, resolveAssetUrl } from '@/lib/ceremony-api'
import { templateById } from '@/lib/design-templates'
import { translate } from '@/lib/tamil-ui'
import { cn } from '@/lib/utils'
import {
  useCeremony,
  localized,
  defaultEntriesDesign,
  defaultDetailFields,
  defaultEntryFields,
  defaultFunctionDetails,
  detailFieldCatalog,
  entriesColumnCatalog,
  entriesRowHeights,
  entriesSheets,
  entriesTableStyles,
  entryFieldCatalog,
  inviteeGroups,
  languageOptions,
  normalizeReceiptDesign,
  setupStepCount,
  setupStepDescriptions,
  setupStepNames,
  setupStepTamilDescriptions,
  setupStepTamilNames,
} from '@/components/ceremony-provider'
import { clearPendingFunctionId, clearSetupDraft, readSetupDraft, resolveFunctionId, writeSetupDraft } from '@/lib/setup-draft'

export function SetupScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const resumeMode = searchParams.get('mode')
  const { scheduledFunctions, entries, updateFunctionDetails, uiLanguage, receiptDesign, saveReceiptDesign, error: syncError, clearError } = useCeremony()
  const existing = editId ? scheduledFunctions.find((item) => item.id === editId) : undefined
  const [functionId] = useState(() => resolveFunctionId(editId))
  const [restored] = useState(() => readSetupDraft(functionId))
  const [step, setStep] = useState(restored.step)
  const [details, setDetails] = useState(restored.details ?? (existing ? { ...defaultFunctionDetails, ...existing, id: functionId } : { ...defaultFunctionDetails, id: functionId }))
  const [detailFields, setDetailFields] = useState(restored.detailFields ?? defaultDetailFields)
  const [entryFields, setEntryFields] = useState(restored.entryFields ?? defaultEntryFields)
  const [groups, setGroups] = useState(restored.groups ?? [...inviteeGroups])
  const [newGroup, setNewGroup] = useState('')
  const [language, setLanguage] = useState(restored.language ?? receiptDesign?.language ?? 'Both')
  const [entriesDesign, setEntriesDesign] = useState(restored.entriesDesign ?? { ...defaultEntriesDesign, ...(receiptDesign.entriesDesign ?? {}) })
  const [design, setDesign] = useState(() => seedDesign(receiptDesign))
  const [stepErrors, setStepErrors] = useState([])
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState(restored.step > 0 ? localized(uiLanguage, `Resumed from step ${restored.step + 1} of ${setupStepCount}.`, `படி ${restored.step + 1} / ${setupStepCount} இலிருந்து தொடர்கிறது.`) : '')
  const backgroundInput = useRef(null)
  const logoInput = useRef(null)
  const t = (text) => translate(text, uiLanguage)

  useEffect(() => {
    writeSetupDraft(functionId, { step, details, detailFields, entryFields, groups, language, entriesDesign })
  }, [functionId, step, details, detailFields, entryFields, groups, language, entriesDesign])

  // Step 3's choice sets the receipt language; keep the designer in sync so
  // the step-6 preview and the saved design both reflect it.
  useEffect(() => {
    setDesign((current) => (current.language === language ? current : { ...current, language }))
  }, [language])

  function addGroup() {
    const value = newGroup.trim()
    if (value && !groups.includes(value)) setGroups((current) => [...current, value])
    setNewGroup('')
  }

  /**
   * Every step's blocking problems. Steps with nothing mandatory return an empty
   * list, which is what lets the user walk straight through them.
   */
  function problemsForStep(index) {
    const problems = []
    if (index === 0) {
      for (const field of detailFields) {
        if (field.required && !String(details[field.key] ?? '').trim()) {
          problems.push({ key: `detail-${field.key}`, label: field.label })
        }
      }
      if (!detailFields.some((field) => field.key === 'name')) {
        problems.push({ key: 'detail-name', label: localized(uiLanguage, 'Function name', 'நிகழ்ச்சி பெயர்') })
      }
    }
    if (index === 1) {
      // `required` on an entry field means the guest must fill it on the
      // collection form, not that anything is typed during setup — so the only
      // thing to check here is that at least one such field still exists.
      if (entryFields.length === 0) {
        problems.push({ key: 'entry-fields', label: localized(uiLanguage, 'At least one guest input', 'குறைந்தது ஒரு விருந்தினர் புலம்') })
      }
    }
    if (index === 4 && entriesDesign.columns.length === 0) {
      problems.push({ key: 'entry-columns', label: localized(uiLanguage, 'At least one column', 'குறைந்தது ஒரு நிரல்') })
    }
    return problems
  }

  /** Blocks forward navigation until every step up to `target` is valid. */
  function goToStep(target) {
    const next = Math.min(Math.max(target, 0), setupStepCount - 1)
    if (next > step) {
      for (let index = 0; index <= next; index += 1) {
        const problems = problemsForStep(index)
        if (problems.length) {
          setStep(index)
          setStepErrors(problems)
          return
        }
      }
    }
    setStepErrors([])
    setStep(next)
  }

  function patchEntries(changes) {
    setEntriesDesign((current) => ({ ...current, ...changes }))
  }

  function toggleColumn(key) {
    setEntriesDesign((current) => {
      const columns = current.columns.includes(key)
        ? current.columns.filter((item) => item !== key)
        : [...current.columns, key]
      return { ...current, columns: columns.length ? columns : ['name'] }
    })
  }

  function moveColumn(key, direction) {
    setEntriesDesign((current) => {
      const columns = [...current.columns]
      const from = columns.indexOf(key)
      const to = from + direction
      if (from < 0 || to < 0 || to >= columns.length) return current
      const [item] = columns.splice(from, 1)
      columns.splice(to, 0, item)
      return { ...current, columns }
    })
  }

  async function uploadSheetImage(file, kind) {
    if (!file?.type.startsWith('image/')) return
    const preview = URL.createObjectURL(file)
    patchEntries(kind === 'logo' ? { logoUrl: preview } : { backgroundUrl: preview })
    try {
      const asset = await uploadsApi.upload(file, kind)
      patchEntries(kind === 'logo' ? { logoUrl: resolveAssetUrl(asset.url) } : { backgroundUrl: resolveAssetUrl(asset.url) })
    } catch {
      // Keep the local preview only — persist() strips blob: URLs so a dead
      // link is never saved. Tell the user the upload did not land.
      setNotice(localized(uiLanguage, 'Image upload failed — the preview is local only and will not be saved.', 'பட பதிவேற்றம் தோல்வியடைந்தது — முன்னோட்டம் மட்டும் உள்ளூரில் இருக்கும், சேமிக்கப்படாது.'))
    }
  }

  useEffect(() => {
    if (step !== setupStepCount - 1) return
    updateFunctionDetails({ ...details, id: functionId, entryFields, detailFields, inviteeGroups: groups, language })
  }, [step])

  const isNewFunction = !editId || resumeMode === 'new'

  /** blob: previews from a failed upload must never reach the server. */
  const stripBlobUrls = (entriesLike) => ({
    ...entriesLike,
    logoUrl: entriesLike.logoUrl?.startsWith('blob:') ? '' : entriesLike.logoUrl,
    backgroundUrl: entriesLike.backgroundUrl?.startsWith('blob:') ? '' : entriesLike.backgroundUrl,
  })

  function persist() {
    saveReceiptDesign({ ...stripBlobUrls(design), language, entriesDesign: stripBlobUrls(entriesDesign) })
  }

  async function finish() {
    // Re-check every step: the details are what actually gets persisted.
    for (let index = 0; index < setupStepCount; index += 1) {
      const problems = problemsForStep(index)
      if (problems.length) {
        setStep(index)
        setStepErrors(problems)
        return
      }
    }
    setStepErrors([])
    // Both writes must land before navigating, otherwise the wizard can
    // "succeed" while the record never reached the API.
    const [savedFunction] = await Promise.all([
      updateFunctionDetails({ ...details, id: functionId, entryFields, detailFields, inviteeGroups: groups, language }),
      persist(),
    ])
    if (savedFunction && savedFunction.ok === false) {
      setNotice(savedFunction.error)
      setSaveError(savedFunction.error)
      return
    }
    setSaveError('')
    clearSetupDraft(functionId)
    if (isNewFunction) clearPendingFunctionId()

    const saved = savedFunction?.value
    // A collection was already open: the setup is stored but must not take it
    // over, so say so and send the user to the calendar instead of a collection
    // that is not theirs.
    if (saved?.activationBlocked) {
      const message = localized(
        uiLanguage,
        `Saved as Upcoming. Close "${saved.holderName}" first — only one collection can be open at a time.`,
        `வரவிருக்கும் நிகழ்ச்சியாகச் சேமிக்கப்பட்டது. முதலில் "${saved.holderName}" ஐ மூடவும் — ஒரே நேரத்தில் ஒரு சேகரிப்பே திறக்க முடியும்.`,
      )
      setNotice(message)
      navigate('/calendar', { state: { notice: message } })
      return
    }

    setNotice(localized(uiLanguage, existing && !isNewFunction ? 'Setup updated for this function.' : 'Function setup saved. Ready to collect.', existing && !isNewFunction ? 'இந்த நிகழ்ச்சிக்கான அமைப்பு புதுப்பிக்கப்பட்டது.' : 'நிகழ்ச்சி அமைப்பு சேமிக்கப்பட்டது. சேகரிக்கத் தயார்.'))
    navigate(existing && !isNewFunction ? '/calendar' : '/collection')
  }

  const previewHtml = useMemo(() => buildEntriesReportHtml({
    functionName: details.name,
    venue: details.venue,
    organizer: details.organizer,
    entries,
    design: entriesDesign,
    autoPrint: false,
  }), [details.name, details.venue, details.organizer, entries, entriesDesign])

  function printEntriesList() {
    if (!entries.length) {
      setNotice('Record a gift first — the printed list needs at least one entry.')
      return
    }
    const opened = printEntriesReport({
      functionName: details.name,
      venue: details.venue,
      organizer: details.organizer,
      entries,
      design: entriesDesign,
      headingFontSize: entriesDesign.headingFontSize,
      bodyFontSize: entriesDesign.bodyFontSize,
    })
    if (!opened) setNotice('Your browser blocked the print window. Allow pop-ups for this site and try again.')
  }

  const stepLabel = localized(uiLanguage, `Step ${step + 1} of ${setupStepCount}`, `படி ${step + 1} / ${setupStepCount}`)

  return <AppShell>
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow={existing && !isNewFunction ? 'EDIT A CELEBRATION' : 'A NEW CELEBRATION'}
        eyebrowTamil={existing && !isNewFunction ? 'ஒரு கொண்டாட்டத்தைத் திருத்து' : 'புதிய கொண்டாட்டம்'}
        title={existing && !isNewFunction ? 'Edit function setup' : 'Function setup'}
        titleTamil={existing && !isNewFunction ? 'நிகழ்ச்சி அமைப்பைத் திருத்து' : 'நிகழ்ச்சி அமைப்பு'}
        subtitle={existing && !isNewFunction ? 'Update the details for this function. Its receipts and entries stay untouched.' : 'Six steps from the function details to the printed receipt.'}
        subtitleTamil={existing && !isNewFunction ? 'இந்த நிகழ்ச்சியின் விவரங்களைப் புதுப்பிக்கவும். ரசீதுகள் மற்றும் பதிவுகள் மாறாது.' : 'நிகழ்ச்சி விவரங்கள் முதல் அச்சிக்கப்படும் ரசீது வரை ஆறு படிகள்.'}
        action={<Link to="/calendar" className="secondary-action"><ArrowLeft className="size-4" /><UiText english="Calendar" tamil="நாட்காட்டி" /></Link>}
      />
      <Surface className="p-5 sm:p-8">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#9b7b37]">{stepLabel}</p>
            <h2 className="mt-2 text-xl font-semibold">{localized(uiLanguage, setupStepNames[step], setupStepTamilNames[step])}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{localized(uiLanguage, setupStepDescriptions[step], setupStepTamilDescriptions[step])}</p>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5f0df] text-sm font-semibold text-[#947632]">0{step + 1}</span>
        </div>

        <div className="wizard-stepper mb-5 grid grid-cols-6 gap-2" aria-label={stepLabel}>
          {setupStepNames.map((name, index) => {
          // A step is reachable only if everything before it passes validation.
          const blocked = index > step && problemsForStep(index - 1).length > 0
          return <button key={name} type="button" onClick={() => goToStep(index)} aria-disabled={blocked || undefined} aria-label={localized(uiLanguage, `Go to ${name}`, `${setupStepTamilNames[index]} படிக்குச் செல்லவும்`)} aria-current={step === index ? 'step' : undefined} className={cn('wizard-step-target', blocked && 'opacity-40')}><span className={`wizard-step-bar ${step >= index ? 'wizard-step-bar-active' : ''}`} /></button>
        })}
        </div>

        {step === 0 && <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-secondary/25 p-4">
            <div className="flex items-start gap-3">
              <div className="stat-icon stat-icon-gold shrink-0"><CalendarDays className="size-5" /></div>
              <div>
                <h3 className="text-sm font-semibold"><UiText english="Choose what to record about this function" tamil="இந்த நிகழ்ச்சியைப் பற்றி என்ன தகவல்கள் பதிவு செய்ய வேண்டும்" /></h3>
                <p className="mt-1 text-xs text-muted-foreground"><UiText english="Remove any input you do not need or add your own. Function type stays on the ceremony card." tamil="தேவையில்லாத புலத்தை நீக்கவும் அல்லது புதியதைச் சேர்க்கவும். நிகழ்ச்சி வகை கொண்டாட்ட அட்டையிலேயே இருக்கும்." /></p>
              </div>
            </div>
          </div>
          <FieldManager fields={detailFields} onChange={(next) => { setDetailFields(next); setStepErrors((current) => current.filter((problem) => !problem.key.startsWith('detail-'))) }} catalog={detailFieldCatalog} max={10} addLabel={localized(uiLanguage, 'Add a detail input', 'விவரப் புலத்தைச் சேர்க்கவும்')} emptyHint={localized(uiLanguage, 'All detail inputs removed. Add at least the function name to continue.', 'விவரப் புலங்கள் அனைத்தும் நீக்கப்பட்டன. தொடர்வதற்கு நிகழ்ச்சி பெயரைச் சேர்க்கவும்.')} />
          <div className="grid gap-5 sm:grid-cols-2">{detailFields.map((field) => <DetailFieldInput key={field.key} field={field} details={details} onChange={(next) => { setDetails(next); setStepErrors((current) => current.filter((problem) => problem.key !== `detail-${field.key}`)) }} uiLanguage={uiLanguage} invalid={stepErrors.some((problem) => problem.key === `detail-${field.key}`)} />)}</div>
        </section>}

        {step === 1 && <section>
          <FieldManager fields={entryFields} onChange={(next) => { setEntryFields(next); setStepErrors([]) }} catalog={entryFieldCatalog} max={12} addLabel={localized(uiLanguage, 'Add a guest input', 'விருந்தினர் புலத்தைச் சேர்க்கவும்')} emptyHint={localized(uiLanguage, 'No guest inputs left. Add at least one to collect gifts.', 'விருந்தினர் புலங்கள் எதுவும் இல்லை. பரிசுகளைப் பதிவு செய்ய குறைந்தது ஒன்று சேர்க்கவும்.')} />
          {stepErrors.some((problem) => problem.key === 'entry-fields') && <p role="alert" id="entry-fields" tabIndex={-1} className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">{localized(uiLanguage, 'Add at least one guest input to continue.', 'தொடர குறைந்தது ஒரு விருந்தினர் புலத்தைச் சேர்க்கவும்.')}</p>}
          <div className="mt-6 rounded-2xl bg-[#f6f4ec] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{localized(uiLanguage, 'Preview on the collection form', 'சேகரிப்புப் படிவத்தில் முன்னோட்டம்')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">{entryFields.map((field, index) => <span key={field.key} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold"><span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{index + 1}</span>{field.label}{field.required && <span className="text-destructive">*</span>}</span>)}</div>
            <p className="mt-4 text-xs text-muted-foreground">{localized(uiLanguage, 'These fields can also become columns on the printed entries list in step 5.', 'இந்தப் புலங்களை படி 5 இல் அச்சிக்கப்படும் பதிவுப் பட்டியலின் நிரல்களாகவும் பயன்படுத்தலாம்.')}</p>
          </div>
        </section>}

        {step === 2 && <section>
          <div className="mb-4">
            <h3 className="text-sm font-semibold"><UiText english="Invitee groups" tamil="அழைப்பாளர் குழுக்கள்" /></h3>
            <p className="mt-1 text-xs text-muted-foreground"><UiText english="Keep track of which side or circle each blessing comes from." tamil="ஒவ்வொரு பரிசும் எந்தப் பக்கம் அல்லது குழுவிலிருந்து வருகிறது என்பதைப் பதிவு செய்யுங்கள்." /></p>
          </div>
          <div className="flex min-h-28 flex-wrap content-start gap-3 rounded-2xl border border-dashed border-border bg-background p-4">
            {groups.map((group) => <span key={group} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#e2dccb] bg-[#faf8f1] px-3 text-sm font-medium text-[#5b594d]">{group}<button type="button" onClick={() => setGroups((current) => current.filter((item) => item !== group))} aria-label={`Remove ${group}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></span>)}
          </div>
          <div className="mt-4 flex max-w-md gap-2">
            <input className="form-input" value={newGroup} onChange={(event) => setNewGroup(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); addGroup() } }} placeholder={localized(uiLanguage, 'Add a group name', 'குழுவின் பெயரைச் சேர்க்கவும்')} />
            <button type="button" onClick={addGroup} className="primary-action shrink-0 px-4"><Plus className="size-4" /><UiText english="Add" tamil="சேர்" /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{inviteeGroups.filter((group) => !groups.includes(group)).map((group) => <button key={group} type="button" onClick={() => setGroups((current) => [...current, group])} className="secondary-action min-h-10 px-3 text-xs"><Plus className="size-3.5" />{group}</button>)}</div>
        </section>}

        {step === 3 && <section>
          <h3 className="mb-4 text-sm font-semibold">{t('Choose the language for your labels')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">{languageOptions.map((item) => <button key={item} type="button" onClick={() => setLanguage(item)} aria-pressed={language === item} className={`language-card ${language === item ? 'language-card-active' : ''}`}><span className="text-lg font-semibold">{item}</span><span className="mt-1 text-xs text-muted-foreground">{item === 'Both' ? 'English + தமிழ்' : item === 'Tamil' ? 'தமிழில்' : 'English only'}</span></button>)}</div>
          <div className="mt-6 rounded-2xl bg-[#f6f4ec] p-5">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{localized(uiLanguage, 'Live label preview', 'நேரடி ரசீது முன்னோட்டம்')}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-8"><PreviewLabel title="Guest Name" tamil="விருந்தினர் பெயர்" language={language} /><PreviewLabel title="Amount" tamil="தொகை" language={language} /><PreviewLabel title="Payment Mode" tamil="பணம் செலுத்தும் முறை" language={language} /></div>
            <p className="mt-4 text-xs text-muted-foreground">{localized(uiLanguage, 'This also sets the starting receipt language in step 6.', 'இது படி 6 இல் ரசீதின் தொடக்க மொழியையும் அமைக்கும்.')}</p>
          </div>
        </section>}

        {step === 4 && <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.85fr)]">
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-xs leading-5 text-primary">
              {t('This step designs the printed entries list handed to the host family. It never changes the receipt — that lives in step 6.')}
            </div>

            <div>
              <h3 className="text-sm font-semibold">{t('Sheet size')}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">{entriesSheets.map((option) => <button key={option} type="button" onClick={() => patchEntries({ sheet: option })} aria-pressed={entriesDesign.sheet === option} className={`designer-option min-h-11 ${entriesDesign.sheet === option ? 'designer-option-active' : ''}`}>{option}</button>)}</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{t('Table style')}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">{entriesTableStyles.map((option) => <button key={option} type="button" onClick={() => patchEntries({ tableStyle: option })} aria-pressed={entriesDesign.tableStyle === option} className={`designer-option min-h-11 ${entriesDesign.tableStyle === option ? 'designer-option-active' : ''}`}>{option}</button>)}</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{t('Row height')}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">{entriesRowHeights.map((option) => <button key={option} type="button" onClick={() => patchEntries({ rowHeight: option })} aria-pressed={entriesDesign.rowHeight === option} className={`designer-option min-h-11 ${entriesDesign.rowHeight === option ? 'designer-option-active' : ''}`}>{option}</button>)}</div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 id="entry-columns" tabIndex={-1} className="text-sm font-semibold">{t('Columns')}</h3>
                <span className="text-xs text-muted-foreground">{entriesDesign.columns.length} / {entriesColumnCatalog.length}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{localized(uiLanguage, 'Turn a column on, then drag it into the order you want on the sheet.', 'நிரலை இயக்கி, தாளில் வரும் வரிசைக்கு ஏற்ப மாற்றவும்.')}</p>
              <ul className="mt-3 flex flex-col gap-1.5">{entriesColumnCatalog.map((column) => {
                const on = entriesDesign.columns.includes(column.key)
                const position = entriesDesign.columns.indexOf(column.key)
                return <li key={column.key} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 transition ${on ? 'border-primary bg-primary/5' : 'border-border bg-background opacity-70'}`}>
                  <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={on} onChange={() => toggleColumn(column.key)} className="size-4 accent-primary" />
                    <span className="truncate">{uiLanguage === 'Tamil' && column.tamil ? column.tamil : column.label}</span>
                  </label>
                  <button type="button" onClick={() => moveColumn(column.key, -1)} disabled={!on || position <= 0} aria-label={`Move ${column.label} up`} className="p-1 text-muted-foreground disabled:opacity-25"><ArrowLeft className="mx-auto size-4 -rotate-90" /></button>
                  <button type="button" onClick={() => moveColumn(column.key, 1)} disabled={!on || position === entriesDesign.columns.length - 1} aria-label={`Move ${column.label} down`} className="p-1 text-muted-foreground disabled:opacity-25"><ArrowRight className="mx-auto size-4 rotate-90" /></button>
                </li>
              })}</ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{t('Border')}</h3>
              <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">{BORDER_STYLES.map((option) => <button key={option.id} type="button" onClick={() => patchEntries({ borderStyle: option.id })} aria-pressed={entriesDesign.borderStyle === option.id} className={`designer-option flex-col gap-1 py-1.5 ${entriesDesign.borderStyle === option.id ? 'designer-option-active' : ''}`}><span className="block h-4 w-7 rounded-[3px]" style={{ border: borderCss(option.id, entriesDesign.borderWidth, entriesDesign.borderColor) }} /><span className="text-[10px]">{t(option.label)}</span></button>)}</div>
              <div className="mt-3 flex items-center gap-2">
                <label className="relative size-9 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: normalizeHex(entriesDesign.borderColor, '#c9a24b') }} title={t('Pick a colour')}><input type="color" className="color-swatch-input" value={normalizeHex(entriesDesign.borderColor, '#c9a24b')} onChange={(event) => patchEntries({ borderColor: event.target.value })} aria-label={t('Border colour')} /></label>
                <input value={entriesDesign.borderColor} onChange={(event) => patchEntries({ borderColor: event.target.value })} onBlur={() => patchEntries({ borderColor: normalizeHex(entriesDesign.borderColor, '#c9a24b') })} className="form-input min-h-9 flex-1 text-xs" aria-label={t('Border colour')} />
              </div>
              <label className="mt-3 block">
                <span className="mb-1 flex items-center justify-between text-xs font-semibold"><span>{t('Thickness')}</span><span className="font-normal text-muted-foreground">{entriesDesign.borderWidth}px</span></span>
                <input type="range" min="0" max="10" step="1" value={entriesDesign.borderWidth} onChange={(event) => patchEntries({ borderWidth: Number(event.target.value) })} className="w-full accent-primary" />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleRow label={t('Show serial number column')} checked={entriesDesign.columns.includes('serial')} onChange={() => toggleColumn('serial')} />
              <ToggleRow label={t('Print the heading')} checked={entriesDesign.showHeading} onChange={(checked) => patchEntries({ showHeading: checked })} />
              <ToggleRow label={t('Show totals row')} checked={entriesDesign.showTotals} onChange={(checked) => patchEntries({ showTotals: checked })} />
              <ToggleRow label={t('Show summary block')} checked={entriesDesign.showSummary} onChange={(checked) => patchEntries({ showSummary: checked })} />
              <ToggleRow label={t('Print centred on the page')} checked={entriesDesign.centreOnPage} onChange={(checked) => patchEntries({ centreOnPage: checked })} />
              <ToggleRow label={t('Show payment reference')} checked={entriesDesign.columns.includes('paymentReference')} onChange={() => toggleColumn('paymentReference')} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => backgroundInput.current?.click()} className="secondary-action"><ImagePlus className="size-4" />{entriesDesign.backgroundUrl ? t('Replace background') : t('Upload background')}</button>
              <button type="button" onClick={() => logoInput.current?.click()} className="secondary-action"><ImagePlus className="size-4" />{entriesDesign.logoUrl ? t('Replace logo') : t('Upload logo')}</button>
              {entriesDesign.backgroundUrl && <button type="button" onClick={() => patchEntries({ backgroundUrl: '' })} className="soft-action"><Trash2 className="size-4" />{t('Remove background')}</button>}
              {entriesDesign.logoUrl && <button type="button" onClick={() => patchEntries({ logoUrl: '' })} className="soft-action"><Trash2 className="size-4" />{t('Remove logo')}</button>}
              <select value={entriesDesign.logoPosition} onChange={(event) => patchEntries({ logoPosition: event.target.value })} className="form-select min-h-[52px] w-auto" aria-label={t('Logo position')}>{['Left', 'Center', 'Right'].map((option) => <option key={option}>{option}</option>)}</select>
              <input ref={backgroundInput} type="file" accept="image/*" className="hidden" onChange={(event) => uploadSheetImage(event.target.files?.[0], 'background')} />
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(event) => uploadSheetImage(event.target.files?.[0], 'logo')} />
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:sticky lg:top-40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{localized(uiLanguage, 'Entries list preview', 'பதிவுப் பட்டியல் முன்னோட்டம்')}</p>
              <button type="button" onClick={printEntriesList} className="secondary-action px-3 text-xs"><Printer className="size-4" />{t('Print entries list')}</button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-[#eeece3] p-3">
              <iframe title={t('Entries list preview')} srcDoc={previewHtml} className="h-[560px] w-full rounded-xl border-0 bg-white" />
            </div>
            <p className="text-xs text-muted-foreground">{t('Entries list only')} · {t('Receipt designs live in Step 6')}</p>
          </div>
        </section>}

        {step === 5 && <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="max-w-2xl text-xs leading-5 text-primary">{t('Shape the printed receipt: layers, borders, alignment and colours. Everything here appears on the guest’s receipt.')}</p>
            <Link to={`/receipt-designer?fn=${functionId}${isNewFunction ? '&mode=new' : ''}`} className="secondary-action px-3 text-xs"><Palette className="size-4" />{t('Open full screen')}</Link>
          </div>
          <ReceiptDesigner
            design={design}
            onChange={(next) => setDesign({ ...next, elements: (next.elements ?? []).map((element, order) => ({ ...element, order })) })}
            onSave={persist}
            functionName={details.name}
            venue={details.venue}
            entry={entries[0] ?? null}
            uiLanguage={uiLanguage}
          />
        </section>}

        {(saveError || syncError) && <div role="alert" className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{localized(uiLanguage, 'Could not save your setup', 'உங்கள் அமைப்பைச் சேமிக்க முடியவில்லை')}</p>
          <p className="mt-1 break-words text-sm text-destructive">{saveError || syncError}</p>
          <button type="button" onClick={() => { setSaveError(''); clearError() }} className="secondary-action mt-3 min-h-10 px-3 text-xs"><UiText english="Dismiss" tamil="மூடு" /></button>
        </div>}

        {stepErrors.length > 0 && <div role="alert" className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{localized(uiLanguage, 'Fill these in to continue', 'தொடர இதை நிரப்பவும்')}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-destructive">
            {stepErrors.map((problem) => <li key={problem.key} className="flex items-center gap-2">
              <button type="button" onClick={() => document.getElementById(problem.key)?.focus()} className="text-left underline underline-offset-2">{problem.label}</button>
            </li>)}
          </ul>
        </div>}

        <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          {step > 0
            ? <button type="button" onClick={() => goToStep(step - 1)} className="secondary-action"><ChevronLeft className="size-4" /><UiText english="Previous" tamil="முந்தையது" /></button>
            : <span />}
          {step < setupStepCount - 1
            ? <button type="button" onClick={() => goToStep(step + 1)} className="primary-action"><UiText english="Continue" tamil="தொடரவும்" /> <ChevronRight className="size-4" /></button>
            : <button type="button" onClick={finish} className="primary-action"><Check className="size-4" /><UiText english={existing && !isNewFunction ? 'Save changes' : 'Save & Start Collection'} tamil={existing && !isNewFunction ? 'மாற்றங்களைச் சேமி' : 'சேமித்து சேகரிப்பைத் தொடங்கு'} /> <ArrowRight className="size-4" /></button>}
        </div>
        {notice && <p role="status" className="mt-3 text-center text-sm text-primary">{notice}</p>}
      </Surface>
      <p className="text-center text-xs text-muted-foreground">{localized(uiLanguage, 'Your setup is saved to your account.', 'உங்கள் அமைப்பு உங்கள் கணக்கில் சேமிக்கப்படும்.')}</p>
    </div>
  </AppShell>
}

/** Picks the Classic template the first time a function reaches the designer. */
function seedDesign(receiptDesign) {
  const normalized = normalizeReceiptDesign(receiptDesign)
  if (normalized.elements.length) return { ...normalized, language: normalized.language || 'Both' }
  const template = templateById('classic')
  return {
    ...normalized,
    template: template.name,
    accent: template.accent,
    border: template.border,
    borderColor: template.accent,
    fontSize: template.fontSize,
    alignment: template.alignment,
    elements: normalizeReceiptDesign({ elements: template.elements }).elements,
  }
}

function ToggleRow({ label, checked, onChange }) {
  return <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" />
    {label}
  </label>
}

function PreviewLabel({ title, tamil, language }) {
  return <div><p className="text-sm font-semibold">{language !== 'Tamil' && title}{language === 'Both' && ' · '}{language !== 'English' && <span className="tamil-font">{tamil}</span>}</p><div className="mt-2 h-2 w-32 rounded-full bg-[#dcd9ce]" /></div>
}

export default SetupScreen
