/**
 * Builds the printable A4 entries list handed to the host family.
 *
 * This is deliberately separate from the receipt design: it only renders the
 * table of guests, the columns chosen in "Entries Template Design", and the
 * optional sheet background. Nothing here reads receipt layers.
 */

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const rupees = (value) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`

export const reportTotal = (entries) => (entries ?? []).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0)

export const reportModeTotals = (entries) =>
  (entries ?? []).reduce((totals, entry) => {
    const mode = entry.mode ?? 'Other'
    totals[mode] = (totals[mode] ?? 0) + (Number(entry.amount) || 0)
    return totals
  }, {})

/** Column definitions the report knows how to fill. */
export const REPORT_COLUMNS = {
  serial: { label: 'S.No', align: 'center', width: '8%' },
  name: { label: 'Guest', align: 'left', width: '20%' },
  city: { label: 'City', align: 'left', width: '13%' },
  relation: { label: 'Relation', align: 'left', width: '13%' },
  giftType: { label: 'Gift', align: 'left', width: '13%' },
  mode: { label: 'Payment', align: 'left', width: '11%' },
  paymentReference: { label: 'Reference', align: 'left', width: '17%' },
  amount: { label: 'Amount', align: 'right', width: '13%' },
  receipt: { label: 'Receipt No.', align: 'left', width: '11%' },
  time: { label: 'Time', align: 'left', width: '9%' },
}

/** Row values for one entry, keyed the same way as REPORT_COLUMNS. */
function cellValue(key, entry, index) {
  const reference = entry.paymentDetails
    ? Object.values(entry.paymentDetails).filter(Boolean).join(' · ')
    : ''
  switch (key) {
    case 'serial': return String(index + 1)
    case 'name': return entry.name
    case 'city': return entry.city
    case 'relation': return entry.relation
    case 'giftType': return entry.giftType
    case 'mode': return entry.mode
    case 'paymentReference': return reference
    case 'amount': return rupees(entry.amount)
    case 'receipt': return entry.receipt
    case 'time': return entry.time
    default: return entry.custom?.[key] ?? ''
  }
}

const paletteFor = (tableStyle) => {
  switch (tableStyle) {
    case 'Classic ledger': return { head: '#173d35', line: '#b9ae8d', zebra: '#f6f2e6', ink: '#173025' }
    case 'Modern grid': return { head: '#1b2a3a', line: '#d6dbe0', zebra: '#f3f5f8', ink: '#16202b' }
    case 'Traditional gold': return { head: '#7a5a12', line: '#d9c48a', zebra: '#fbf5e6', ink: '#4a3a12' }
    case 'Minimal monochrome': return { head: '#4a4a4a', line: '#d8d8d8', zebra: '#fafafa', ink: '#2b2b2b' }
    case 'Celebration floral': return { head: '#8c3f57', line: '#e0bcc8', zebra: '#fdf2f5', ink: '#5c2637' }
    case 'Compact report': return { head: '#2f4858', line: '#c9d2d8', zebra: '#f2f5f7', ink: '#22333d' }
    case 'Totals first': return { head: '#0f4d3a', line: '#c4d4cb', zebra: '#eef5f1', ink: '#14342a' }
    default: return { head: '#173d35', line: '#d9ceb1', zebra: '#fbf8ee', ink: '#1d2a24' }
  }
}

export function buildEntriesReportHtml({
  functionName = 'Function',
  venue = '',
  organizer = '',
  entries = [],
  design = {},
  subtitle = 'Complete entries report',
  footnote = '',
  headingFontSize = 22,
  bodyFontSize = 11,
  autoPrint = true,
} = {}) {
  const {
    sheet = 'Plain A4',
    tableStyle = 'Clean table',
    rowHeight = 'Standard',
    columns = ['serial', 'name', 'relation', 'mode', 'amount', 'receipt'],
    showTotals = true,
    showSummary = true,
    showHeading = true,
    centreOnPage = true,
    backgroundUrl = '',
    logoUrl = '',
    logoPosition = 'Center',
    borderStyle = 'solid',
    borderColor = '#c9a24b',
    borderWidth = 2,
  } = design

  const list = entries ?? []
  const total = reportTotal(list)
  const palette = paletteFor(tableStyle)
  const activeColumns = (columns ?? []).filter((key) => REPORT_COLUMNS[key])
  const columnList = activeColumns.length ? activeColumns : ['serial', 'name', 'amount']
  const landscape = sheet === 'A4 landscape'
  const small = sheet === 'A5 list'
  const rowPadding = rowHeight === 'Compact' ? '3px 6px' : rowHeight === 'Roomy' ? '10px 8px' : '6px 8px'
  const logoSide = logoPosition === 'Left' ? 'flex-start' : logoPosition === 'Right' ? 'flex-end' : 'center'
  const sheetWidth = landscape ? '277mm' : small ? '180mm' : '178mm'
  const headingSize = design.headingFontSize ?? headingFontSize
  const bodySize = design.bodyFontSize ?? bodyFontSize

  const head = showHeading
    ? `<header class="head">
        ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="" />` : ''}
        <div class="head-text">
          <h1>${escapeHtml(functionName)}</h1>
          <p class="sub">${escapeHtml(subtitle)}${tableStyle ? ` · ${escapeHtml(tableStyle)}` : ''}</p>
          <p class="meta-line">${[venue, organizer, `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ')}</p>
        </div>
      </header>`
    : ''

  const headCells = columnList
    .map((key) => {
      const column = REPORT_COLUMNS[key]
      return `<th style="width:${column.width};text-align:${column.align}">${escapeHtml(column.label)}</th>`
    })
    .join('')

  const bodyRows = list.length
    ? list
        .map((entry, index) => {
          const cells = columnList
            .map((key) => {
              const column = REPORT_COLUMNS[key]
              return `<td class="${key === 'amount' ? 'amount' : ''}" style="text-align:${column.align}">${escapeHtml(cellValue(key, entry, index) || '—')}</td>`
            })
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
    : `<tr><td class="empty" colspan="${columnList.length}">No entries recorded yet</td></tr>`

  const modeTotals = reportModeTotals(list)
  const totalsBlock = showTotals
    ? `<div class="total"><span>Total collection</span><span>${rupees(total)}</span></div>`
    : ''
  const summaryBlock = showSummary && list.length
    ? `<div class="summary">${Object.entries(modeTotals).map(([mode, value]) => `<span class="chip"><b>${escapeHtml(mode)}</b> ${rupees(value)}</span>`).join('')}</div>`
    : ''

  const styles = `
    @page { size: ${landscape ? 'A4 landscape' : small ? 'A5' : 'A4'}; margin: ${small ? '10mm' : '12mm'}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: ${palette.ink}; font-family: "Inter", "Noto Sans Tamil", Arial, sans-serif; }
    body { display: flex; justify-content: ${centreOnPage ? 'center' : 'flex-start'}; }
    .sheet {
      position: relative;
      width: ${sheetWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: ${small ? '10mm' : '12mm'};
      border: ${borderWidth}px ${borderStyle} ${borderColor};
      background: #ffffff;
      overflow: hidden;
    }
    .sheet-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .16; pointer-events: none; }
    .sheet-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 6mm; }
    .head { display: flex; align-items: flex-start; justify-content: ${logoSide}; gap: 6mm; }
    .head-text { flex: 1; text-align: ${logoPosition === 'Left' || logoPosition === 'Right' ? 'left' : 'center'}; }
    .logo { max-height: 18mm; max-width: 32mm; object-fit: contain; }
    h1 { margin: 0; font-size: ${headingSize}px; line-height: 1.2; }
    .sub { margin: 2mm 0 0; font-size: ${bodySize + 1}px; color: #6a716b; }
    .meta-line { margin: 2mm 0 0; font-size: ${bodySize - 1}px; color: #83897f; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid ${palette.line}; padding: ${rowPadding}; font-size: ${bodySize}px; vertical-align: middle; }
    th { background: ${palette.head}; color: #ffffff; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    tbody tr:nth-child(even) td { background: ${palette.zebra}; }
    td.amount { font-weight: 700; font-variant-numeric: tabular-nums; }
    td.empty { padding: 14mm 6mm; color: #8b9189; text-align: center; }
    .total { display: flex; align-items: center; justify-content: space-between; gap: 6mm; border-radius: 2mm; background: ${palette.head}; padding: 4mm 5mm; color: #ffffff; font-size: ${bodySize + 4}px; font-weight: 800; }
    .total span:last-child { font-variant-numeric: tabular-nums; }
    .summary { display: flex; flex-wrap: wrap; gap: 3mm; }
    .chip { border: 1px solid ${palette.line}; border-radius: 999px; padding: 2mm 4mm; font-size: ${bodySize}px; }
    .chip b { margin-right: 2mm; }
    .foot { margin-top: 2mm; border-top: 1px solid ${palette.line}; padding-top: 3mm; color: #83897f; font-size: ${bodySize - 1}px; text-align: center; }
    .foot-note { display: flex; justify-content: space-between; gap: 6mm; margin-top: 3mm; color: #6a716b; font-size: ${bodySize - 1}px; }
    @media print { body { display: block; } .sheet { border-width: ${borderWidth}px; } }
  `

  const printScript = autoPrint ? '<script>window.addEventListener("load", function () { setTimeout(function () { window.print() }, 120) })</script>' : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(functionName)} — Entries list</title><style>${styles}</style></head><body><main class="sheet">${backgroundUrl ? `<img class="sheet-bg" src="${escapeHtml(backgroundUrl)}" alt="" />` : ''}<div class="sheet-body">${head}<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>${totalsBlock}${summaryBlock}<div class="foot-note"><span>${escapeHtml(footnote || `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`)}</span><span>${escapeHtml(venue)}</span></div><div class="foot">Generated by muhurtham · Every gift, remembered.</div></div></main>${printScript}</body></html>`
}

/**
 * Opens the report in a new window and prints it.
 * `noopener` makes `window.open` return null, which silently killed the report
 * on Chrome/Edge — the window is created without it and detached afterwards.
 */
export function printEntriesReport(options) {
  const win = window.open('', '_blank', 'width=980,height=1200')
  if (!win) return false
  win.opener = null
  win.document.open()
  win.document.write(buildEntriesReportHtml(options))
  win.document.close()
  win.focus()
  return true
}
