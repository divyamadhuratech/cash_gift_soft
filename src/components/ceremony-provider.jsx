import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { designsApi, describeError, entriesApi, functionsApi, isApiAvailable } from '@/lib/ceremony-api'
import { useAuth } from '@/contexts/AuthContext'

export const uiLanguageStorageKey = 'muhurtham-ui-language'
export const activeFunctionStorageKey = 'muhurtham-active-function'

export function localized(language, english, tamil) {
  return language === 'Tamil' ? tamil : english
}

const CeremonyContext = createContext(null)

export function CeremonyProvider({ children }) {
  const { token } = useAuth()
  const [entriesByFunction, setEntriesByFunction] = useState({})
  const [draftsByFunction, setDraftsByFunction] = useState({})
  const [receiptDesignsByFunction, setReceiptDesignsByFunction] = useState({})
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [scheduledFunctions, setScheduledFunctions] = useState([])
  const [archivedFunctions, setArchivedFunctions] = useState([])
  const [activeFunctionId, setActiveFunctionId] = useState(() => {
    try { return window.localStorage.getItem(activeFunctionStorageKey) ?? '' } catch { return '' }
  })
  const [isDark, setIsDark] = useState(false)
  const [uiLanguage, setUiLanguage] = useState('English')
  const [languageLoaded, setLanguageLoaded] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const functionDetails = scheduledFunctions.find((item) => item.id === activeFunctionId) ?? scheduledFunctions[0] ?? null
  const activeId = functionDetails?.id ?? ''
  /** The function currently holding the single open collection slot, if any. */
  const openCollection = scheduledFunctions.find((item) => item.collectionOpenAt && !item.archived) ?? null
  const entries = activeId ? (entriesByFunction[activeId] ?? []) : []
  const draftEntry = activeId ? (draftsByFunction[activeId] ?? null) : null
  const storedDesign = activeId ? receiptDesignsByFunction[activeId] : undefined
  const receiptDesign = useMemo(
    () => normalizeReceiptDesign(storedDesign ?? defaultReceiptDesign),
    [storedDesign],
  )

  const fromApi = useCallback((record) => ({
    ...record,
    id: record.id ?? record._id,
    tamil: record.tamil ?? '',
    status: record.status ?? statusForDate(record.date),
    archived: Boolean(record.archived),
    // Set by the server while this function holds the open collection slot.
    collectionOpenAt: record.collectionOpenAt ?? null,
    entryFields: record.entryFields?.length ? record.entryFields.map((field, order) => ({ ...field, order })) : defaultEntryFields,
    inviteeGroups: record.inviteeGroups ?? [],
  }), [])

  /** Loads functions (open + archived), their designs and their entries. */
  const refresh = useCallback(async () => {
    if (!isApiAvailable()) {
      setStatus('offline')
      return
    }
    setStatus('loading')
    setError('')
    try {
      const [open, archived, designs] = await Promise.all([
        functionsApi.list({ archived: 'false' }),
        functionsApi.list({ archived: 'true' }),
        designsApi.list(),
      ])

      const openFunctions = (open.functions ?? []).map(fromApi)
      const archivedRecords = (archived.functions ?? []).map(fromApi)

      // Closed functions keep their entries so the report stays printable.
      const archivedEntries = await Promise.all(
        archivedRecords.map(async (record) => {
          const result = await entriesApi.list({ function: record.id, limit: 1000 }).catch((requestError) => {
            setError(describeError(requestError, `Could not load archived entries for "${record.name}"`))
            return null
          })
          const list = result?.entries ?? []
          return [record.id, list.map(fromEntry)]
        }),
      )

      const designMap = {}
      for (const design of designs?.designs ?? []) {
        if (!design.function) continue
        designMap[design.function] = normalizeReceiptDesign(design)
      }

      setScheduledFunctions(openFunctions)
      setArchivedFunctions(archivedRecords)
      setReceiptDesignsByFunction(designMap)
      setEntriesByFunction(Object.fromEntries(archivedEntries))
      setStatus('ready')

      setActiveFunctionId((current) => {
        const valid = current && (openFunctions.some((item) => item.id === current) || archivedRecords.some((item) => item.id === current))
        // A stale id must never silently land on an arbitrary function: if the
        // stored one is gone, prefer the collection that is actually open.
        const holder = openFunctions.find((item) => item.collectionOpenAt)
        const next = valid ? current : holder?.id ?? openFunctions[0]?.id ?? ''
        if (next) {
          try { window.localStorage.setItem(activeFunctionStorageKey, next) } catch { /* ignore */ }
        }
        return next
      })
    } catch (requestError) {
      setStatus('error')
      setError(describeError(requestError, 'Could not load your functions'))
    }
  }, [fromApi])

  // Reload whenever the signed-in account changes. Signing out clears local
  // state so the next user never sees the previous one's functions.
  useEffect(() => {
    if (!token) {
      setScheduledFunctions([])
      setArchivedFunctions([])
      setEntriesByFunction({})
      setReceiptDesignsByFunction({})
      setActiveFunctionId('')
      setSelectedEntry(null)
      setStatus('idle')
      return
    }
    refresh()
  }, [refresh, token])

  // Entries for the active function are fetched on demand.
  useEffect(() => {
    if (!activeId || !isApiAvailable()) return
    let cancelled = false
    entriesApi.list({ function: activeId, limit: 1000 })
      .then((result) => {
        if (cancelled) return
        setEntriesByFunction((current) => ({ ...current, [activeId]: (result.entries ?? []).map(fromEntry) }))
      })
      .catch((requestError) => {
        if (cancelled) return
        setError(describeError(requestError, 'Could not load entries'))
      })
    return () => { cancelled = true }
  }, [activeId])

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(uiLanguageStorageKey)
    if (savedLanguage === 'English' || savedLanguage === 'Tamil') setUiLanguage(savedLanguage)
    setLanguageLoaded(true)
  }, [])

  useEffect(() => {
    if (!languageLoaded) return
    window.localStorage.setItem(uiLanguageStorageKey, uiLanguage)
    document.documentElement.lang = uiLanguage === 'Tamil' ? 'ta' : 'en'
    document.documentElement.dataset.uiLanguage = uiLanguage.toLowerCase()
  }, [uiLanguage, languageLoaded])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const changeActiveFunction = useCallback((id) => {
    setActiveFunctionId(id)
    setSelectedEntry(null)
    try { window.localStorage.setItem(activeFunctionStorageKey, id) } catch { /* ignore */ }
  }, [])

  /**
   * Makes `id` the collection being worked on — the one choke point every
   * switch goes through, which is why the lock lives here.
   *
   * Returns `{ ok, value?, error? }`. While another function still holds the
   * open slot this refuses and surfaces the reason, so a freshly scheduled
   * function can never take over a collection that is in progress.
   */
  const startCollection = useCallback(async (id) => {
    const record = scheduledFunctions.find((item) => item.id === id) ?? archivedFunctions.find((item) => item.id === id)
    if (!record) return { ok: false, error: 'That function is no longer available.' }
    if (record.archived) return { ok: false, error: 'That collection is closed. Reopen it before starting it again.' }

    if (record.collectionOpenAt) {
      changeActiveFunction(id)
      return { ok: true, value: record }
    }

    const holder = scheduledFunctions.find((item) => item.id !== id && item.collectionOpenAt && !item.archived)
    if (holder) {
      const message = `Close "${holder.name}" before starting this collection. Only one collection can be open at a time.`
      setError(message)
      return { ok: false, error: message }
    }

    if (!isRemoteId(id)) {
      changeActiveFunction(id)
      return { ok: true, value: record }
    }

    try {
      const result = await functionsApi.open(id)
      const opened = fromApi(result.function)
      setScheduledFunctions((current) => current.map((item) => (item.id === id ? opened : item)))
      changeActiveFunction(id)
      return { ok: true, value: opened }
    } catch (requestError) {
      const message = describeError(requestError, 'Could not start the collection')
      setError(message)
      return { ok: false, error: message }
    }
  }, [scheduledFunctions, archivedFunctions, changeActiveFunction, fromApi])

  const selectFunction = startCollection

  /**
   * Creates the function when the id is new, otherwise patches the existing one.
   *
   * Saving is deliberately not the same as opening: while a collection is in
   * progress the new/edited function is stored but left inactive, and the
   * result carries `activationBlocked` so the caller can say why.
   */
  const upsertFunction = useCallback(async (record) => {
    const payload = {
      ...record,
      // The goal is a number field in the form but a string until it is parsed.
      targetCollection: Number(record.targetCollection) || 0,
      entryFields: (record.entryFields ?? []).map((field, order) => ({ ...field, order })),
    }
    const isRemote = record.id && isRemoteId(record.id)
    const result = isRemote
      ? await functionsApi.update(record.id, payload)
      : await functionsApi.create(payload)
    const saved = fromApi(result.function)
    setScheduledFunctions((current) => current.some((item) => item.id === saved.id)
      ? current.map((item) => (item.id === saved.id ? saved : item))
      : [...current, saved])

    const holder = scheduledFunctions.find((item) => item.id !== saved.id && item.collectionOpenAt && !item.archived)
    if (!holder) changeActiveFunction(saved.id)
    return { ...saved, activationBlocked: Boolean(holder), holderName: holder?.name ?? '' }
  }, [fromApi, changeActiveFunction, scheduledFunctions])

  /**
   * Closing archives the function but never deletes its entries — they are the
   * record the host family prints, so the previous purge call was data loss.
   */
  const closeCollection = useCallback(async (id) => {
    const record = scheduledFunctions.find((item) => item.id === id)
    // Previously returned undefined silently, so the dialog closed and nothing
    // happened. Fail loudly instead.
    if (!record) throw new Error('That function is no longer open — reload the dashboard.')
    if (!isRemoteId(id)) throw new Error('That function has not finished saving yet.')
    await functionsApi.close(id)
    await refresh()
    const nextUpcoming = scheduledFunctions.find((item) => item.id !== id && item.date >= todayISO() && item.status !== 'Completed')
    changeActiveFunction(nextUpcoming?.id ?? '')
    return record
  }, [scheduledFunctions, refresh, changeActiveFunction])

  const isArchived = useCallback((id) => archivedFunctions.some((item) => item.id === id), [archivedFunctions])

  /** Un-archives a closed collection so it can be worked on again. */
  const reopenCollection = useCallback(async (id) => {
    if (!isRemoteId(id)) throw new Error('That function cannot be reopened.')
    await functionsApi.reopen(id)
    await refresh()
  }, [refresh])

  const updateFunctionDetails = useCallback((details) => upsertFunction(details), [upsertFunction])

  const addEntry = useCallback(async (entry) => {
    const { id: _id, receipt: _receipt, ...payload } = entry
    const result = await entriesApi.create({ ...payload, function: activeId, date: entry.date ?? todayISO() })
    const saved = fromEntry(result.entry)
    setEntriesByFunction((current) => ({ ...current, [activeId]: [saved, ...(current[activeId] ?? [])] }))
    setSelectedEntry(saved)
    return saved
  }, [activeId])

  const updateEntry = useCallback(async (receipt, entry) => {
    const existing = entries.find((item) => item.receipt === receipt)
    if (!existing || !isRemoteId(existing.id)) return undefined
    const { id: _id, ...payload } = entry
    const result = await entriesApi.update(existing.id, payload)
    const saved = fromEntry(result.entry)
    setEntriesByFunction((current) => ({ ...current, [activeId]: (current[activeId] ?? []).map((item) => (item.receipt === receipt ? saved : item)) }))
    setSelectedEntry(saved)
    return saved
  }, [entries, activeId])

  const removeEntry = useCallback(async (receipt) => {
    const existing = entries.find((item) => item.receipt === receipt)
    if (!existing) return undefined
    setEntriesByFunction((current) => ({ ...current, [activeId]: (current[activeId] ?? []).filter((item) => item.receipt !== receipt) }))
    setSelectedEntry((current) => (current?.receipt === receipt ? null : current))
    if (isRemoteId(existing.id)) await entriesApi.remove(existing.id)
    return existing
  }, [entries, activeId])

  const saveReceiptDesign = useCallback(async (design) => {
    if (!activeId) return
    const normalized = normalizeReceiptDesign(design)
    const remoteId = isRemoteId(normalized.id) ? normalized.id : null
    const payload = { ...normalized, function: activeId }
    const result = remoteId
      ? await designsApi.update(remoteId, payload)
      : await designsApi.create({ ...payload, name: payload.name ?? 'Receipt design' })
    const saved = normalizeReceiptDesign(result.design ?? payload)
    setReceiptDesignsByFunction((current) => ({ ...current, [activeId]: saved }))
  }, [activeId])

  /** Runs an async mutation, surfacing failures instead of swallowing them. */
  const run = useCallback(async (action, fallbackMessage) => {
    setError('')
    try {
      return { ok: true, value: await action() }
    } catch (requestError) {
      const message = describeError(requestError, fallbackMessage)
      setError(message)
      return { ok: false, error: message }
    }
  }, [])

  const value = useMemo(() => ({
    uiLanguage,
    setUiLanguage,
    receiptDesign,
    saveReceiptDesign: (design) => run(() => saveReceiptDesign(design), 'Could not save the receipt design'),
    status,
    error,
    clearError: () => setError(''),
    refresh,
    functionDetails,
    activeFunctionId: activeId,
    scheduledFunctions,
    archivedFunctions,
    closeCollection: (id) => run(() => closeCollection(id), 'Could not close the collection'),
    reopenCollection: (id) => run(() => reopenCollection(id), 'Could not reopen the collection'),
    isArchived,
    upsertFunction: (record) => run(() => upsertFunction(record), 'Could not save the function'),
    startCollection,
    selectFunction,
    updateFunctionDetails: (details) => run(() => updateFunctionDetails(details), 'Could not save the function'),
    entries,
    addEntry: (entry) => run(() => addEntry(entry), 'Could not save this gift'),
    updateEntry: (receipt, entry) => run(() => updateEntry(receipt, entry), 'Could not update this gift'),
    removeEntry: (receipt) => run(() => removeEntry(receipt), 'Could not remove this gift'),
    draftEntry,
    setDraftEntry: (draft) => activeId && setDraftsByFunction((current) => ({ ...current, [activeId]: draft })),
    selectedEntry,
    setSelectedEntry,
    isDark,
    toggleDark: () => setIsDark((current) => !current),
  }), [entries, draftEntry, selectedEntry, functionDetails, activeId, scheduledFunctions, archivedFunctions, receiptDesign, uiLanguage, status, error, refresh, isDark, saveReceiptDesign, closeCollection, reopenCollection, isArchived, upsertFunction, startCollection, updateFunctionDetails, addEntry, updateEntry, removeEntry, run])

  return <CeremonyContext.Provider value={value}>{children}</CeremonyContext.Provider>
}

/** Mongo ObjectIds are 24 hex chars; locally generated ids are prefixed. */
const isRemoteId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)

const fromEntry = (record) => ({
  ...record,
  id: record.id ?? record._id,
  custom: record.custom ?? {},
  paymentDetails: record.paymentDetails ?? {},
})

export function useCeremony() {
  const context = useContext(CeremonyContext)
  if (!context) throw new Error('useCeremony must be used inside CeremonyProvider')
  return context
}

/** Receipt defaults. Every key here is safe to override from a saved design. */
export const defaultReceiptDesign = {
  name: 'Receipt design',
  theme: 'Classic',
  template: 'Classic',
  paper: 'A6',
  border: 'double',
  borderColor: '',
  borderWidth: 2,
  accent: '#b28e3e',
  fontSize: 16,
  alignment: 'center',
  lineHeight: 1.5,
  letterSpacing: 0,
  padding: 20,
  language: 'Both',
  logoUrl: '',
  logoPosition: 'Center',
  backgroundUrl: '',
  elements: [],
  entriesPageDesign: 'Clean table',
}

/** Legacy designs stored `elements` as plain names — keep both shapes working. */
const legacyElementText = {
  Header: 'GIFT RECEIPT',
  'Function Name': '{function_name}',
  'Guest Name': '{guest_name}',
  Amount: '{amount}',
  'Payment Mode': '{payment_mode}',
  Message: 'Thank you for your blessings',
  Watermark: 'WITH GRATITUDE',
  Footer: '{receipt_no} · {date}',
}

/**
 * Coerce any stored/remote design into one predictable shape. Elements are
 * de-duplicated by `id` so a template can never render a line twice.
 */
export function normalizeReceiptDesign(design) {
  const merged = { ...defaultReceiptDesign, ...(design ?? {}) }
  const raw = Array.isArray(merged.elements) ? merged.elements : []
  const seen = new Set()
  const elements = []
  raw.forEach((item, index) => {
    const name = typeof item === 'string' ? item : item?.name
    if (!name) return
    const id = (typeof item === 'object' && item?.id) || name.toLowerCase().replaceAll(' ', '-')
    if (seen.has(id)) return
    seen.add(id)
    elements.push({
      id,
      name,
      kind: typeof item === 'object' && item?.kind ? item.kind : 'text',
      english: typeof item === 'object' ? (item.english ?? '') : (legacyElementText[name] ?? ''),
      tamil: typeof item === 'object' ? (item.tamil ?? '') : '',
      visible: typeof item === 'object' && item.visible !== undefined ? Boolean(item.visible) : true,
      textColor: typeof item === 'object' ? (item.textColor ?? '') : '',
      align: typeof item === 'object' ? (item.align ?? '') : '',
      weight: typeof item === 'object' ? (item.weight ?? '') : '',
      spacing: typeof item === 'object' ? Number(item.spacing ?? 0) || 0 : 0,
      order: typeof item === 'object' && item.order !== undefined ? Number(item.order) : index,
    })
  })
  return {
    ...merged,
    elements: elements.map((element, order) => ({ ...element, order })),
    entriesDesign: { ...defaultEntriesDesign, ...(design?.entriesDesign ?? {}) },
  }
}

/** Today as YYYY-MM-DD in the device's local timezone. */
export const todayISO = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export const statusForDate = (iso) => {
  if (!iso) return 'Upcoming'
  const today = todayISO()
  if (iso < today) return 'Completed'
  return iso === today ? 'Active' : 'Upcoming'
}

export const formatScheduleDate = (iso, { withYear = true } = {}) => {
  if (!iso) return 'Date not set'
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(date)
}

export const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`

export const formatRupees = (value) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`
export const totalFor = (items) => (items ?? []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
export const paymentTotals = (items) => (items ?? []).reduce((totals, item) => {
  totals[item.mode] = (totals[item.mode] ?? 0) + (Number(item.amount) || 0)
  return totals
}, { Cash: 0, UPI: 0, Card: 0, Other: 0 })
export const receiptElements = ['Header', 'Function Name', 'Guest Name', 'Amount', 'Payment Mode', 'Message', 'Watermark', 'Footer']
export const setupFields = ['Name', 'City', 'Relation', 'Gift Type']
export const inviteeGroups = ['Groom side', 'Bride side', 'Friends', 'Office']
export const occasionTypes = ['Wedding', 'Engagement', 'Birthday', 'Housewarming', 'Temple', 'Anniversary', 'Custom']
export const designThemes = ['Classic', 'Modern', 'Traditional']
export const receiptThemeStyles = { Classic: 'receipt-classic', Modern: 'receipt-modern', Traditional: 'receipt-traditional' }
export const entriesReportTemplates = ['Clean table', 'Compact report', 'Totals first', 'Classic ledger', 'Modern grid', 'Traditional gold', 'Minimal monochrome', 'Celebration floral']
/**
 * Six real steps. The old "Occasion" step rendered nothing, and the receipt
 * designer used to live on a separate route, so it is now the last step.
 */
export const setupStepNames = ['Details', 'Fields', 'Groups', 'Language', 'Entries Template Design', 'Receipt Designer']
export const setupStepDescriptions = [
  'Add function details',
  'Choose guest information',
  'Organize your invitees',
  'Set the language',
  'Design the printed entries list',
  'Shape your receipt',
]
export const setupStepTamilNames = ['விவரங்கள்', 'புலங்கள்', 'குழுக்கள்', 'மொழி', 'பதிவுப் பட்டியல் வடிவமைப்பு', 'ரசீது வடிவமைப்பு']
export const setupStepTamilDescriptions = [
  'நிகழ்ச்சி விவரங்களைச் சேர்க்கவும்',
  'விருந்தினர் தகவலைத் தேர்ந்தெடுக்கவும்',
  'அழைப்பாளர்களை ஒழுங்குபடுத்தவும்',
  'ரசீது மொழியை அமைக்கவும்',
  'அச்சிக்கப்படும் பதிவுப் பட்டியலை வடிவமைக்கவும்',
  'உங்கள் ரசீதை வடிவமைக்கவும்',
]
export const setupStepCount = setupStepNames.length
export const defaultDesignerElements = [...receiptElements]
export const defaultFunctionDetails = { name: '', venue: '', organizer: '', type: 'Wedding', category: 'Family celebration', date: todayISO(), targetCollection: 0 }
export const setupDefaults = { ...defaultFunctionDetails, fields: [...setupFields], groups: [...inviteeGroups], language: 'Both' }
export const categoryOptions = ['Family celebration', 'Religious function', 'Community event', 'Other']
export const languageOptions = ['English', 'Tamil', 'Both']
export const relationOptions = ['Family', 'Friend', 'Colleague', 'Guest']
export const giftTypeOptions = ['Cash gift', 'Envelope', 'Jewellery', 'Other']

/** Border styles offered by the receipt designer. */
export const borderStyles = ['none', 'solid', 'double', 'dashed', 'dotted', 'thick', 'groove', 'ridge', 'inset', 'outset', 'decorative']

/**
 * Columns available on the printed entries list. `key` matches the entry
 * field it reads, so custom setup fields can be switched on as well.
 */
export const entriesColumnCatalog = [
  { key: 'serial', label: 'S.No', tamil: 'எண்', fixed: true },
  { key: 'name', label: 'Guest', tamil: 'விருந்தினர்', fixed: true },
  { key: 'city', label: 'City', tamil: 'நகரம்' },
  { key: 'relation', label: 'Relation', tamil: 'உறவு' },
  { key: 'giftType', label: 'Gift', tamil: 'பரிசு' },
  { key: 'mode', label: 'Payment', tamil: 'கட்டணம்', fixed: true },
  { key: 'paymentReference', label: 'Reference', tamil: 'குறிப்பு' },
  { key: 'amount', label: 'Amount', tamil: 'தொகை', fixed: true },
  { key: 'receipt', label: 'Receipt No.', tamil: 'ரசீது எண்' },
  { key: 'time', label: 'Time', tamil: 'நேரம்' },
]

export const defaultEntriesColumns = ['serial', 'name', 'relation', 'mode', 'amount', 'receipt']
export const entriesRowHeights = ['Compact', 'Standard', 'Roomy']
export const entriesSheets = ['Plain A4', 'A4 landscape', 'A5 list']
export const entriesTableStyles = ['Clean table', 'Compact report', 'Totals first', 'Classic ledger', 'Modern grid', 'Traditional gold', 'Minimal monochrome', 'Celebration floral']

/** Default shape of the printed entries list. Kept separate from the receipt. */
export const defaultEntriesDesign = {
  sheet: 'Plain A4',
  tableStyle: 'Clean table',
  rowHeight: 'Standard',
  columns: [...defaultEntriesColumns],
  showSerial: true,
  showTotals: true,
  showSummary: true,
  showHeading: true,
  centreOnPage: true,
  backgroundUrl: '',
  logoUrl: '',
  logoPosition: 'Center',
  borderStyle: 'solid',
  borderColor: '#c9a24b',
  borderWidth: 2,
  headingFontSize: 22,
  bodyFontSize: 11,
}

/** Manual inputs captured when a gift is not paid in cash. */
export const paymentDetailCatalog = {
  UPI: [
    { key: 'upiId', label: 'UPI ID', tamil: 'யூபிஐ அடையாளம்', placeholder: 'name@bank', required: false },
    { key: 'upiRef', label: 'UPI reference number', tamil: 'யூபிஐ குறிப்பு எண்', placeholder: 'e.g. 5231 4477 8890', required: false },
    { key: 'upiApp', label: 'Paid through', tamil: 'செலுத்திய முறை', placeholder: 'GPay / PhonePe / Paytm', required: false },
  ],
  Card: [
    { key: 'cardType', label: 'Card type', tamil: 'அட்டை வகை', placeholder: 'Credit / Debit', required: false },
    { key: 'cardLast4', label: 'Card last 4 digits', tamil: 'கடைசி 4 எண்கள்', placeholder: '1234', required: false, maxLength: 4 },
    { key: 'cardAuth', label: 'Approval code', tamil: 'அங்கீகாரக் குறியீடு', placeholder: 'e.g. 4471', required: false },
  ],
  Other: [
    { key: 'otherMethod', label: 'How was it paid', tamil: 'எப்படிச் செலுத்தப்பட்டது', placeholder: 'Bank transfer / Cheque', required: false },
    { key: 'otherRef', label: 'Reference number', tamil: 'குறிப்பு எண்', placeholder: 'e.g. UTR 004512', required: false },
    { key: 'otherNote', label: 'Note', tamil: 'குறிப்பு', placeholder: 'Anything to remember', required: false },
  ],
}

export const paymentDetailFields = (mode) => paymentDetailCatalog[mode] ?? []

/** Flatten the per-mode manual inputs into one printable reference line. */
export const paymentReferenceText = (mode, details = {}) => {
  const fields = paymentDetailCatalog[mode] ?? []
  return fields
    .map((field) => (details[field.key] ? `${field.label}: ${details[field.key]}` : ''))
    .filter(Boolean)
    .join(' · ')
}

/**
 * The two ordered input lists a user can reshape in Setup.
 * `key` doubles as the storage key — on Entry it is `custom[key]` for custom fields,
 * or the matching column for built-ins (name / city / relation / giftType).
 */
export const detailFieldCatalog = [
  { key: 'name', label: 'Function name', tamil: 'நிகழ்ச்சி பெயர்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'venue', label: 'Venue', tamil: 'இடம்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'organizer', label: 'Organizer', tamil: 'ஒருங்கிணைப்பாளர்', type: 'text', required: false, removable: true, builtin: true },
  { key: 'category', label: 'Category', tamil: 'பிரிவு', type: 'select', options: categoryOptions, required: false, removable: true, builtin: true },
  { key: 'date', label: 'Date', tamil: 'தேதி', type: 'date', required: false, removable: true, builtin: true },
  { key: 'targetCollection', label: 'Collection goal', tamil: 'சேகரிப்பு இலக்கு', type: 'number', required: false, removable: true, builtin: true },
]

export const entryFieldCatalog = [
  { key: 'name', label: 'Guest name', tamil: 'விருந்தினர் பெயர்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'city', label: 'City', tamil: 'நகரம்', type: 'text', required: false, removable: true, builtin: true },
  { key: 'relation', label: 'Relation', tamil: 'உறவு', type: 'select', options: relationOptions, required: false, removable: true, builtin: true },
  { key: 'giftType', label: 'Gift type', tamil: 'பரிசு வகை', type: 'select', options: giftTypeOptions, required: false, removable: true, builtin: true },
]

/** Columns that already exist on the Entry model and are not stored in `custom`. */
export const builtinEntryKeys = new Set(['name', 'city', 'relation', 'giftType'])

export const defaultDetailFields = detailFieldCatalog.map((field, order) => ({ ...field, order }))
export const defaultEntryFields = entryFieldCatalog.map((field, order) => ({ ...field, order }))
export const modeOptions = ['Cash', 'UPI', 'Card', 'Other']
export const defaultCollectionMode = 'Cash'
export const collectionFormTitle = 'Record a gift'
export const collectionFormDescription = 'A warm welcome begins with a thoughtful record.'
export const collectionPlaceholder = 'e.g. Priya or பிரியா'
export const defaultCollectionMessage = 'With gratitude for your blessings'
export const collectionButtonLabel = 'Save & Print Receipt · சேமித்து அச்சிடு'
export const syncNotice = 'Everything you record is saved to your account.'
/** Today, formatted for the greeting line. */
export const todayDate = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
export const logoWord = 'muhurtham'
export const appTagline = 'Every gift, remembered.'
export const loginPageTitle = 'Welcome back'
export const loginPageSubtitle = 'Your collection desk is ready.'
export const loginHint = 'Sign in with the account you registered.'
export const receiptSizeLabel = 'A6 receipt preview'
export const receiptPreviewLabel = 'Live receipt preview'
export const printButtonLabel = 'Print'
export const printAgainLabel = 'Print Again'
export const backToCollectionLabel = 'Back to Collection'
export const successEntryCopy = 'Entry saved. Your receipt is ready to print.'
export const saveDesignLabel = 'Save Design'
export const printTestLabel = 'Print Test'
export const setDefaultLabel = 'Set as Default'
export const exportLabel = 'Export'
export const dateFilterOptions = ['All dates', 'Today', 'Last 7 days', 'This month']
export const minimumAmountLabel = 'Minimum amount'
export const noEntriesHint = 'Try adjusting your search or payment filter.'
export const tableEmptyMessage = 'No entries match. Clear the filters to see all gifts.'

export const exportCsv = (items) => {
  const columns = ['Guest Name', 'Amount', 'Payment Mode', 'Time', 'Receipt No.', 'City', 'Relation', 'Gift Type']
  const escape = (value) => {
    const text = String(value).replaceAll('"', '""')
    const safe = /^[=+@-]/.test(text) ? `'${text}` : text
    return `"${safe}"`
  }
  const rows = [columns, ...items.map((item) => [item.name, item.amount, item.mode, item.time, item.receipt, item.city ?? '', item.relation ?? '', item.giftType ?? ''])]
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'ceremony-gift-entries.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export const modeClass = { Cash: 'payment-cash', UPI: 'payment-upi', Card: 'payment-card', Other: 'payment-other' }