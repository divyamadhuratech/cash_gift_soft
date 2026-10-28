const draftPrefix = 'muhurtham-setup-draft:'
const pendingIdKey = 'muhurtham-setup-pending-id'

const draftKey = (functionId) => `${draftPrefix}${functionId}`

const emptyDraft = { step: 0, details: null, fields: null, groups: null, language: 'Both', entriesDesign: null }

export function readSetupDraft(functionId) {
  if (!functionId) return emptyDraft
  try {
    const raw = window.localStorage.getItem(draftKey(functionId))
    if (!raw) return emptyDraft
    const parsed = JSON.parse(raw)
    return { ...emptyDraft, ...parsed, step: Math.min(Math.max(Number(parsed.step) || 0, 0), 5) }
  } catch {
    return emptyDraft
  }
}

export function writeSetupDraft(functionId, draft) {
  if (!functionId) return
  try { window.localStorage.setItem(draftKey(functionId), JSON.stringify(draft)) } catch { return }
}

export function clearSetupDraft(functionId) {
  try { window.localStorage.removeItem(draftKey(functionId)) } catch { return }
}

export function resolveFunctionId(editId) {
  if (editId) return editId
  try {
    const pending = window.sessionStorage.getItem(pendingIdKey)
    if (pending) return pending
    const id = `fn-${Math.random().toString(36).slice(2, 9)}`
    window.sessionStorage.setItem(pendingIdKey, id)
    return id
  } catch {
    return `fn-${Math.random().toString(36).slice(2, 9)}`
  }
}

export function clearPendingFunctionId() {
  try { window.sessionStorage.removeItem(pendingIdKey) } catch { return }
}