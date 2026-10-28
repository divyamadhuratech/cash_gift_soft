import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CirclePlus, Clock3, Gift, Sparkles, Undo2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppShell, PageHeading, PaymentBadge, PillToggle, SectionTitle, Surface, UiText } from '@/components/ceremony/shared'
import { ThanglishComposer } from '@/components/ceremony/thanglish-composer'
import { EntryFieldInput } from '@/components/ceremony/entry-field-input'
import { useCeremony, localized, collectionFormDescription, collectionFormTitle, collectionPlaceholder, defaultCollectionMode, defaultEntryFields, formatRupees, paymentDetailFields, paymentReferenceText, syncNotice, totalFor } from '@/components/ceremony-provider'
import { paymentModes } from '@/components/ceremony/types'
import { conversionFlow, convertTamilWord, tamilModeLabel, tamilValidationExamples } from '@/lib/tamil-transliteration'

const modeStorageKey = 'muhurtham-last-payment-mode'
const fastModeStorageKey = 'muhurtham-fast-entry-mode'
const modeTamil = { Cash: 'ரொக்கம்', UPI: 'யூபிஐ', Card: 'அட்டை', Other: 'மற்றவை' }

export function CollectionScreen() {
  const [searchParams] = useSearchParams()
  const editReceipt = searchParams.get('edit')
  const { entries, addEntry, updateEntry, removeEntry, draftEntry, setDraftEntry, setSelectedEntry, functionDetails, uiLanguage, error: syncError, clearError: clearSyncError } = useCeremony()
  const editingEntry = editReceipt ? entries.find((entry) => entry.receipt === editReceipt) : undefined
  const nameRef = useRef(null)
  const cityRef = useRef(null)
  const recentSaves = useRef([])
  const draftHydrated = useRef(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState(defaultCollectionMode)
  const [city, setCity] = useState('')
  const [relation, setRelation] = useState('')
  const [giftType, setGiftType] = useState('')
  const [customValues, setCustomValues] = useState({})
  const [paymentDetails, setPaymentDetails] = useState({})
  const [language, setLanguage] = useState('English')
  const [nameInputMode, setNameInputMode] = useState('English')
  const [cityInputMode, setCityInputMode] = useState('English')
  const [fastMode, setFastMode] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [draftNotice, setDraftNotice] = useState('')
  const parsedAmount = Number(amount.replace(/[^\d.]/g, '')) || 0

  useEffect(() => {
    const savedMode = window.localStorage.getItem(modeStorageKey)
    if (paymentModes.includes(savedMode)) setMode(savedMode)
    setFastMode(window.localStorage.getItem(fastModeStorageKey) === 'true')
  }, [])

  useEffect(() => {
    if (editingEntry || !draftEntry || draftHydrated.current) return
    draftHydrated.current = true
    setName(draftEntry.name ?? '')
    setAmount(draftEntry.amount ? String(draftEntry.amount) : '')
    setMode(draftEntry.mode ?? defaultCollectionMode)
    setCity(draftEntry.city ?? '')
    setRelation(draftEntry.relation ?? '')
    setGiftType(draftEntry.giftType ?? '')
    setCustomValues(draftEntry.custom ?? {})
    setPaymentDetails(draftEntry.paymentDetails ?? {})
    setDraftNotice('Draft restored — continue this entry')
  }, [draftEntry, editingEntry])

  useEffect(() => {
    if (!draftNotice) return
    const timer = window.setTimeout(() => setDraftNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [draftNotice])

  useEffect(() => {
    if (!editingEntry) return
    setName(editingEntry.name)
    setAmount(String(editingEntry.amount))
    setMode(editingEntry.mode)
    setCity(editingEntry.city ?? '')
    setRelation(editingEntry.relation ?? '')
    setGiftType(editingEntry.giftType ?? '')
    setCustomValues(editingEntry.custom ?? {})
    setPaymentDetails(editingEntry.paymentDetails ?? {})
    setMoreDetails(true)
    setSelectedEntry(editingEntry)
  }, [editingEntry, setSelectedEntry])

  function changeMode(nextMode) {
    setMode(nextMode)
    // Manual references belong to one mode — drop the ones that no longer apply.
    const allowed = new Set(paymentDetailFields(nextMode).map((field) => field.key))
    setPaymentDetails((current) => Object.fromEntries(Object.entries(current).filter(([key]) => allowed.has(key))))
    window.localStorage.setItem(modeStorageKey, nextMode)
  }

  function clearForm() {
    setName('')
    setAmount('')
    setCity('')
    setRelation('')
    setGiftType('')
    setCustomValues({})
    setPaymentDetails({})
    setError('')
    setDraftEntry(null)
    setDraftNotice('')
    nameRef.current?.focus()
  }

  function holdDraft() {
    setDraftEntry({ name: name.trim(), amount: parsedAmount || undefined, mode, city: city.trim(), relation, giftType: giftType || 'Cash gift', custom: { ...customValues }, paymentDetails: { ...paymentDetails } })
    setName('')
    setAmount('')
    setCity('')
    setRelation('')
    setGiftType('')
    setCustomValues({})
    setPaymentDetails({})
    setError('')
    setMoreDetails(false)
    setDraftNotice('Draft held — inputs cleared. Continue later or clear the draft.')
    nameRef.current?.focus()
  }

  function setFieldLanguage(next, field) {
    if (field === 'name') setNameInputMode(next)
    else setCityInputMode(next)
  }

  const entryFields = functionDetails?.entryFields?.length ? functionDetails.entryFields : defaultEntryFields
  // Must mirror every built-in key handled by setFieldValue below. Leaving
  // relation/giftType out meant their selects read undefined, stayed blank and
  // looked frozen even though the value was being saved.
  const fieldValues = { name, city, relation, giftType, ...customValues }

  function setFieldValue(key, value, builtin) {
    if (key === 'name') return setName(value)
    if (key === 'city') return setCity(value)
    if (key === 'relation') return setRelation(value)
    if (key === 'giftType') return setGiftType(value)
    if (!builtin) setCustomValues((current) => ({ ...current, [key]: value }))
  }

  function inputModeFor(key) {
    if (key === 'name') return nameInputMode
    if (key === 'city') return cityInputMode
    return 'English'
  }

  function renderEntryField(field) {
    const inputMode = inputModeFor(field.key)
    const composerKeys = ['name', 'city']
    if (composerKeys.includes(field.key)) {
      const isName = field.key === 'name'
      const ref = isName ? nameRef : cityRef
      const toggleLabel = isName ? 'Guest name' : 'City'
      return <div key={field.key}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="form-label mb-0" htmlFor={`entry-field-${field.key}`}>{uiLanguage === 'Tamil' && field.tamil ? field.tamil : field.label} {field.required && <span className="text-destructive">*</span>}</label>
          <button type="button" className="mb-2 rounded-md border border-border bg-background px-1.5 py-1 text-[10px] font-semibold text-muted-foreground" onClick={() => setFieldLanguage(inputMode === tamilModeLabel ? 'English' : tamilModeLabel, field.key)} aria-label={`Toggle ${toggleLabel} typing language`}>A|அ</button>
        </div>
        {inputMode === tamilModeLabel
          ? <ThanglishComposer id={`entry-field-${field.key}`} inputRef={ref} sourcePlaceholder={isName ? 'e.g. ramesh kannan' : 'e.g. madurai'} targetPlaceholder="தமிழ் இங்கே தோன்றும்…" commitLabel={isName ? 'Add name' : 'Add city'} onCommit={(tamil) => setFieldValue(field.key, tamil, true)} />
          : <input id={`entry-field-${field.key}`} ref={ref} className="form-input" autoComplete={isName ? 'name' : 'address-level2'} value={fieldValues[field.key] ?? ''} onChange={(event) => setFieldValue(field.key, event.target.value, true)} required={field.required} placeholder={isName ? collectionPlaceholder : 'e.g. Madurai'} />}
      </div>
    }
    return <EntryFieldInput key={field.key} field={field} values={fieldValues} onChange={setFieldValue} uiLanguage={uiLanguage} languageMode={inputMode} onToggleLanguage={(key) => setFieldLanguage(inputMode === tamilModeLabel ? 'English' : tamilModeLabel, key)} />
  }

  async function saveEntry(event) {
    event.preventDefault()
    if (!functionDetails?.id) {
      setError(localized(uiLanguage, 'Set up a function before recording gifts.', 'பரிசுகளைப் பதிவு செய்ய முன் ஒரு நிகழ்ச்சியை அமைக்கவும்.'))
      return
    }
    if (!name.trim()) {
      setError(localized(uiLanguage, 'Add the guest’s name before saving.', 'சேமிப்பதற்கு முன் விருந்தினர் பெயரை உள்ளிடவும்.'))
      nameRef.current?.focus()
      return
    }
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000000) {
      setError(localized(uiLanguage, 'Enter an amount from ₹1 to ₹1,00,00,000.', '₹1 முதல் ₹1,00,00,000 வரை தொகையை உள்ளிடவும்.'))
      return
    }
    const cleanName = name.trim()
    const now = Date.now()
    recentSaves.current = recentSaves.current.filter((item) => now - item.at < 120000)
    const duplicate = !editingEntry && recentSaves.current.some((item) => item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase() && item.amount === parsedAmount)
    if (duplicate && !window.confirm('This guest and amount were entered in the last 2 minutes. Save again?')) return

    const details = { name: cleanName, amount: parsedAmount, mode, city: city.trim(), relation, giftType: giftType || 'Cash gift', custom: { ...customValues }, paymentDetails: { ...paymentDetails } }
    // Awaited so a failed write keeps the form filled instead of printing a
    // receipt for a gift that was never stored.
    const result = editingEntry ? await updateEntry(editingEntry.receipt, details) : await addEntry(details)
    if (!result?.ok) {
      setError(result?.error ?? localized(uiLanguage, 'Could not save this gift.', 'இந்த பரிசைச் சேமிக்க முடியவில்லை.'))
      return
    }
    const saved = result.value
    recentSaves.current.push({ name: cleanName, amount: parsedAmount, at: now })
    setError('')
    setSelectedEntry(saved)
    setToast(`✓ ${saved.receipt} saved`)
    clearForm()
    window.setTimeout(() => setToast(''), 3200)
  }

  async function undoLast() {
    const last = entries[0]
    if (!last) return
    const result = await removeEntry(last.receipt)
    if (!result?.ok) {
      setError(result?.error ?? localized(uiLanguage, 'Could not undo that entry.', 'அந்த பதிவைச் செயல்தவிர்க்க முடியவில்லை.'))
      return
    }
    setToast(`✓ ${last.receipt} undone`)
    window.setTimeout(() => setToast(''), 2600)
  }
return <AppShell>
    {functionDetails?.id ? <div className="flex flex-col gap-7">
      <PageHeading eyebrow="THE CELEBRATION COLLECTION" eyebrowTamil="நிகழ்ச்சி சேகரிப்பு" title={editingEntry ? 'Edit a gift' : collectionFormTitle} titleTamil={editingEntry ? 'பரிசைத் திருத்து' : 'பரிசைப் பதிவு செய்'} subtitle={editingEntry ? `Update the details for receipt ${editingEntry.receipt}.` : collectionFormDescription} subtitleTamil={editingEntry ? `ரசீது ${editingEntry.receipt} விவரங்களைப் புதுப்பிக்கவும்.` : 'ஒவ்வொரு பரிசையும் அன்புடன் பதிவு செய்யுங்கள்.'} action={<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { const next = !fastMode; setFastMode(next); window.localStorage.setItem(fastModeStorageKey, String(next)) }} className={`secondary-action ${fastMode ? 'border-primary text-primary' : ''}`} aria-pressed={fastMode}><span className={`size-2 rounded-full ${fastMode ? 'bg-primary' : 'bg-muted-foreground'}`} />Fast Entry Mode</button><Link to="/entries-history" className="secondary-action"><Clock3 className="size-4" /><UiText english="Entries history" tamil="பதிவுகள் வரலாறு" /></Link></div>} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
        <Surface className="p-5 sm:p-8">
          <form onSubmit={saveEntry} className="flex flex-col gap-6">
            {!fastMode && <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="page-kicker"><Sparkles className="size-3.5" />{localized(uiLanguage, 'A MOMENT TO REMEMBER', 'நினைவில் நிற்கும் தருணம்')}</p></div><PillToggle options={['English', 'தமிழ்']} value={language} onChange={(next) => { setLanguage(next); setFieldLanguage(next, 'name'); setFieldLanguage(next, 'city') }} label="Guest name language" /></div>}

            <div className="grid gap-5 sm:grid-cols-2">{entryFields.map(renderEntryField)}</div>

            <div className="amount-panel rounded-2xl p-4 sm:p-5">
              <label className="form-label" htmlFor="gift-amount"><UiText english="Amount" tamil="தொகை" /> <span className="text-destructive">*</span></label>
              <div className="flex items-center gap-3"><span className="text-3xl font-medium text-[#b4934c]">₹</span><input id="gift-amount" className="form-input amount-input" type="number" min="1" max="10000000" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
              <div className="mt-3 flex flex-wrap gap-2">{[100, 500, 1000, 5000].map((value) => <button key={value} type="button" className="quick-amount" onClick={() => setAmount(String(parsedAmount + value))}>+{value.toLocaleString('en-IN')}</button>)}<button type="button" className="quick-amount" onClick={() => setAmount(String(parsedAmount + 1))}>+1</button></div>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{localized(uiLanguage, 'Enter the exact gift amount in rupees.', 'பரிசுத் தொகையை ரூபாயில் சரியாக உள்ளிடவும்.')}</p><p className="text-sm font-semibold text-primary">Current gift: {formatRupees(parsedAmount)}</p></div>
            </div>

            <fieldset>
              <legend className="form-label"><UiText english="Payment mode" tamil="பணம் செலுத்தும் முறை" /></legend>
              <div className="choice-grid">{paymentModes.map((item) => <button key={item} type="button" onClick={() => changeMode(item)} aria-pressed={mode === item} className={`choice-button ${mode === item ? 'choice-button-active' : ''}`}><span className={`payment-dot payment-${item.toLowerCase()}`} />{localized(uiLanguage, item, modeTamil[item])}</button>)}</div>
              {paymentDetailFields(mode).length > 0 && <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{localized(uiLanguage, `Enter the ${mode} details manually`, `${modeTamil[mode]} விவரங்களைக் கைமுறையாக உள்ளிடவும்`)}</p>
                <div className="grid gap-3 sm:grid-cols-2">{paymentDetailFields(mode).map((field) => <label key={field.key} className="block"><span className="form-label">{uiLanguage === 'Tamil' && field.tamil ? field.tamil : field.label}</span><input className="form-input" value={paymentDetails[field.key] ?? ''} maxLength={field.maxLength} inputMode={field.key === 'cardLast4' ? 'numeric' : field.key.startsWith('upi') ? 'email' : 'text'} placeholder={field.placeholder} onChange={(event) => setPaymentDetails((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}</div>
                {paymentReferenceText(mode, paymentDetails) && <p className="mt-3 text-xs text-muted-foreground"><span className="font-semibold"><UiText english="Saved as" tamil="சேமிக்கப்படுகிறது" />: </span>{paymentReferenceText(mode, paymentDetails)}</p>}
              </div>}
            </fieldset>

            {!fastMode && <details className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Tamil conversion checks</summary><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-5">{tamilValidationExamples.map((word) => <span key={word}><b>{word}</b> → {convertTamilWord(word).text}</span>)}</div><p className="mt-3 text-xs text-muted-foreground">Flow for <b>pooja</b>: exact dictionary → {conversionFlow('pooja')} → பூஜா. Tap a suggestion chip to remember the spelling for that word.</p></details>}

            {syncError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{syncError}</span><button type="button" onClick={clearSyncError} className="secondary-action min-h-10 px-3 text-xs"><UiText english="Dismiss" tamil="மூடு" /></button></div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {(draftEntry || draftNotice) && <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary" role="status">{draftNotice || 'One entry is held as a draft.'}</div>}

            <div className="flex flex-col gap-3 sm:flex-row"><button type="submit" className="primary-action flex-1"><Gift className="size-4" />{editingEntry ? 'Save Changes' : 'Save & Print Receipt'}<ArrowRight className="size-4" /></button><button type="button" onClick={holdDraft} className="text-link px-2 text-sm">Hold draft</button><button type="button" onClick={clearForm} className="text-link px-2 text-sm">Clear</button></div>
            <p className="text-center text-xs text-muted-foreground">{localized(uiLanguage, syncNotice, 'உங்கள் பதிவுகள் உங்கள் கணக்கில் சேமிக்கப்படும்.')}</p>
          </form>
        </Surface>

        <div className="flex flex-col gap-5 lg:sticky lg:top-40">
          <Surface className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><SectionTitle title="Today, in a glance" titleTamil="இன்றைய சேகரிப்பு" description="Your collection so far" descriptionTamil="இதுவரையிலான வசூல்" /><span className="stat-icon stat-icon-green"><Gift /></span></div><p className="mt-2 text-3xl font-semibold tracking-tight">{formatRupees(totalFor(entries))}</p><p className="mt-1 text-xs text-muted-foreground">{entries.length} {localized(uiLanguage, 'gifts recorded', 'பரிசுகள் பதிவு செய்யப்பட்டன')} · {functionDetails?.venue ?? ''}</p></Surface>
          <Surface className="overflow-hidden"><div className="flex items-start justify-between gap-3 p-5 pb-3"><SectionTitle title="Last 5 entries" titleTamil="கடைசி 5 பதிவுகள்" description="Recently recorded gifts" descriptionTamil="சமீபத்தில் பதிவு செய்த பரிசுகள்" /><button type="button" onClick={undoLast} disabled={!entries.length} className="text-link shrink-0 text-xs"><Undo2 className="size-3.5" />Undo</button></div><div className="divide-y divide-border">{entries.slice(0, 5).map((entry) => <button key={entry.receipt} type="button" onClick={() => setSelectedEntry(entry)} className="flex min-h-[67px] w-full items-center gap-3 px-5 text-left"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f3efe1] text-sm font-semibold text-[#907333]">{entry.name.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{entry.name}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{entry.receipt}</span></span><span className="flex flex-col items-end gap-1"><span className="text-sm font-semibold">{formatRupees(entry.amount)}</span><PaymentBadge mode={entry.mode} /></span></button>)}</div></Surface>
        </div>
      </div>
      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl">{toast}</div>}
    </div> : <Surface className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><Gift className="size-6" /></span>
      <h2 className="mt-4 text-lg font-semibold">{localized(uiLanguage, 'No function selected', 'எந்த நிகழ்ச்சியும் தேர்ந்தெடுக்கப்படவில்லை')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{localized(uiLanguage, 'Create a function first — every gift is recorded against one.', 'முதலில் ஒரு நிகழ்ச்சியை உருவாக்கவும் — ஒவ்வொரு பரிசும் அதன் கீழே பதிவேற்றப்படும்.')}</p>
      <Link to="/function-setup" className="primary-action mt-5"><CirclePlus className="size-4" />{localized(uiLanguage, 'Set up a function', 'நிகழ்ச்சியை அமைக்கவும்')}<ArrowRight className="size-4" /></Link>
    </Surface>}
  </AppShell>
}
