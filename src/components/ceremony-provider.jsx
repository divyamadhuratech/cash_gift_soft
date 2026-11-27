import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CeremonyContext } from '@/contexts/ceremony-context'
import { useAuth } from '@/contexts/useAuth'
import { activeFunctionStorageKey, defaultEntryFields, uiLanguageStorageKey } from '@/constants/ceremony-catalog'
import { defaultReceiptDesign, normalizeReceiptDesign } from '@/lib/receipt-design'
import { isRemoteId, fromEntry, statusForDate, todayISO } from '@/lib/ceremony-format'
import { designsApi, describeError, entriesApi, functionsApi, isApiAvailable } from '@/lib/ceremony-api'
  
export function CeremonyProvider({ children }) {
  const { token, isAuthenticated } = useAuth()
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
  const [uiLanguage, setUiLanguage] = useState(() => {
    try {
      const saved = window.localStorage.getItem(uiLanguageStorageKey)
      return saved === 'Tamil' ? 'Tamil' : 'English'
    } catch { return 'English' }
  })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  /**
   * Latest state snapshots so the mutation callbacks below can keep stable
   * identities. Their previous dependency on `scheduledFunctions` meant every
   * append produced a new callback identity, which re-fired consumers' effects
   * and re-created the function on the server — the source of the duplicate
   * calendar entries.
   */
  const scheduledFunctionsRef = useRef(scheduledFunctions)
  const archivedFunctionsRef = useRef(archivedFunctions)
  /** Maps a locally generated `fn-…` setup id to its server-assigned id. */
  const remoteIdByLocalId = useRef(new Map())

  useEffect(() => {
    scheduledFunctionsRef.current = scheduledFunctions
    archivedFunctionsRef.current = archivedFunctions
  })

  const functionDetails = scheduledFunctions.find((item) => item.id === activeFunctionId) ?? scheduledFunctions[0] ?? null
  const activeId = functionDetails?.id ?? ''
  /** The function currently holding the single open collection slot, if any. */
  // const openCollection = scheduledFunctions.find((item) => item.collectionOpenAt && !item.archived) ?? null
  // const entries = activeId ? (entriesByFunction[activeId] ?? []) : []
  const entries = useMemo(
  () => (activeId ? entriesByFunction[activeId] ?? [] : []),
  [activeId, entriesByFunction]
)
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

  useEffect(() => {
    if (!token || !isAuthenticated) return
    queueMicrotask(refresh)
  }, [token, isAuthenticated, refresh])

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
    window.localStorage.setItem(uiLanguageStorageKey, uiLanguage)
    document.documentElement.lang = uiLanguage === 'Tamil' ? 'ta' : 'en'
    document.documentElement.dataset.uiLanguage = uiLanguage.toLowerCase()
  }, [uiLanguage])

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
    const records = scheduledFunctionsRef.current
    const record = records.find((item) => item.id === id) ?? archivedFunctionsRef.current.find((item) => item.id === id)
    if (!record) return { ok: false, error: 'That function is no longer available.' }
    if (record.archived) return { ok: false, error: 'That collection is closed. Reopen it before starting it again.' }

    if (record.collectionOpenAt) {
      changeActiveFunction(id)
      return { ok: true, value: record }
    }

    const holder = records.find((item) => item.id !== id && item.collectionOpenAt && !item.archived)
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
  }, [changeActiveFunction, fromApi])

  /**
   * Creates the function when the id is new, otherwise patches the existing one.
   *
   * Saving is deliberately not the same as opening: while a collection is in
   * progress the new/edited function is stored but left inactive, and the
   * result carries `activationBlocked` so the caller can say why.
   *
   * A locally generated `fn-…` id is remembered against the server-assigned
   * ObjectId after the first create, so every later save with that same setup
   * id becomes a PATCH instead of another POST. Without this map each save
   * (auto-save on step 6, the save button, StrictMode's double effect) opened
   * a brand-new record — the duplicate "same function" rows on the calendar.
   */
  const upsertFunction = useCallback(async (record) => {
    const payload = {
      ...record,
      // The goal is a number field in the form but a string until it is parsed.
      targetCollection: Number(record.targetCollection) || 0,
      entryFields: (record.entryFields ?? []).map((field, order) => ({ ...field, order })),
    }
    let remoteId = record.id && isRemoteId(record.id) ? record.id : null
    if (!remoteId && record.id) remoteId = remoteIdByLocalId.current.get(record.id) ?? null
    const result = remoteId
      ? await functionsApi.update(remoteId, payload)
      : await functionsApi.create(payload)
    const saved = fromApi(result.function)
    if (record.id && !isRemoteId(record.id)) remoteIdByLocalId.current.set(record.id, saved.id)
    setScheduledFunctions((current) => current.some((item) => item.id === saved.id)
      ? current.map((item) => (item.id === saved.id ? saved : item))
      : [...current, saved])

    const holder = scheduledFunctionsRef.current.find((item) => item.id !== saved.id && item.collectionOpenAt && !item.archived)
    if (!holder) changeActiveFunction(saved.id)
    return { ...saved, activationBlocked: Boolean(holder), holderName: holder?.name ?? '' }
  }, [fromApi, changeActiveFunction])

  /**
   * Closing archives the function but never deletes its entries — they are the
   * record the host family prints, so the previous purge call was data loss.
   */
  const closeCollection = useCallback(async (id) => {
    const record = scheduledFunctionsRef.current.find((item) => item.id === id)
    // Previously returned undefined silently, so the dialog closed and nothing
    // happened. Fail loudly instead.
    if (!record) throw new Error('That function is no longer open — reload the dashboard.')
    if (!isRemoteId(id)) throw new Error('That function has not finished saving yet.')
    await functionsApi.close(id)
    await refresh()
    // Read through the ref: `refresh` re-rendered with fresh state while this
    // callback's own closure still holds the pre-refresh snapshot.
    const nextUpcoming = scheduledFunctionsRef.current.find((item) => item.id !== id && item.date >= todayISO() && item.status !== 'Completed')
    changeActiveFunction(nextUpcoming?.id ?? '')
    return record
  }, [refresh, changeActiveFunction])

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

  /** Stable wrapper so consumers can safely list it in effect dependencies. */
  const saveFunctionDetails = useCallback((details) => run(() => updateFunctionDetails(details), 'Could not save the function'), [run, updateFunctionDetails])

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
    selectFunction: startCollection,
    updateFunctionDetails: saveFunctionDetails,
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
  }), [entries, draftEntry, selectedEntry, functionDetails, activeId, scheduledFunctions, archivedFunctions, receiptDesign, uiLanguage, status, error, refresh, isDark, saveReceiptDesign, closeCollection, reopenCollection, isArchived, upsertFunction, startCollection, saveFunctionDetails, addEntry, updateEntry, removeEntry, run])

  return <CeremonyContext.Provider value={value}>{children}</CeremonyContext.Provider>
}
