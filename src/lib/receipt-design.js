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

const defaultEntriesColumns = ['serial', 'name', 'relation', 'mode', 'amount', 'receipt']

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
