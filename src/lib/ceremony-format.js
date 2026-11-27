export function localized(language, english, tamil) {
  return language === 'Tamil' ? tamil : english
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

/** Mongo ObjectIds are 24 hex chars; locally generated ids are prefixed. */
export const isRemoteId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)

export const fromEntry = (record) => ({
  ...record,
  id: record.id ?? record._id,
  custom: record.custom ?? {},
  paymentDetails: record.paymentDetails ?? {},
})

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
