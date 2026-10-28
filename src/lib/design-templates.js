export const DESIGN_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    accent: '#b28e3e',
    border: 'double',
    fontSize: 16,
    alignment: 'center',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: 'GIFT RECEIPT', tamil: 'பரிசு ரசீது', visible: true, textColor: '#8a6d2b' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#144a38' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#7d837b' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#27352d' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#0f4d3a' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: '{payment_mode}', tamil: '{payment_mode}', visible: true, textColor: '#333e36' },
      { id: 'divider2', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'thanks', name: 'Message', kind: 'text', english: 'Thank you for your blessings', tamil: 'உங்கள் அன்பிற்கும் ஆசிகளுக்கும் நன்றி', visible: true, textColor: '#34483c' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no} · {date}', tamil: '{receipt_no} · {date}', visible: true, textColor: '#a1a197' },
    ],
  },
  {
    id: 'modern',
    name: 'Modern',
    accent: '#0f4d3a',
    border: 'solid',
    fontSize: 15,
    alignment: 'left',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: 'THANK YOU', tamil: 'நன்றி', visible: true, textColor: '#0f4d3a' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#111c16' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#111c16' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#6b716b' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#0f4d3a' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: 'Paid via {payment_mode}', tamil: '{payment_mode} மூலம் செலுத்தப்பட்டது', visible: true, textColor: '#6b716b' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no}', tamil: '{receipt_no}', visible: true, textColor: '#9aa19b' },
    ],
  },
  {
    id: 'traditional',
    name: 'Traditional',
    accent: '#9b7024',
    border: 'double',
    fontSize: 17,
    alignment: 'center',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: '✦ GIFT RECEIPT ✦', tamil: '✦ பரிசு ரசீது ✦', visible: true, textColor: '#9b7024' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#5c4310' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#7d837b' },
      { id: 'divider2', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#27352d' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#5c4310' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: '{payment_mode}', tamil: '{payment_mode}', visible: true, textColor: '#333e36' },
      { id: 'divider3', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'thanks', name: 'Message', kind: 'text', english: 'With gratitude', tamil: 'அன்புடன்', visible: true, textColor: '#34483c' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{date} · {receipt_no}', tamil: '{date} · {receipt_no}', visible: true, textColor: '#a1a197' },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    accent: '#6d756f',
    border: 'none',
    fontSize: 14,
    alignment: 'center',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: 'RECEIPT', tamil: 'ரசீது', visible: true, textColor: '#6d756f' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#1d2420' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#1d2420' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: '{payment_mode}', tamil: '{payment_mode}', visible: true, textColor: '#8b918b' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no}', tamil: '{receipt_no}', visible: true, textColor: '#aeb4ae' },
    ],
  },
  {
    id: 'temple',
    name: 'Temple',
    accent: '#a9761f',
    border: 'double',
    fontSize: 17,
    alignment: 'center',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: '🪔 GIFT RECEIPT 🪔', tamil: '🪔 பரிசு ரசீது 🪔', visible: true, textColor: '#a9761f' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#6b4a11' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#8a7a5a' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#2f2510' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#a9761f' },
      { id: 'thanks', name: 'Message', kind: 'text', english: 'May the blessings multiply', tamil: 'ஆசிகள் பல்கட்டும்', visible: true, textColor: '#5c4a1f' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no}', tamil: '{receipt_no}', visible: true, textColor: '#a89a78' },
    ],
  },
  {
    id: 'floral',
    name: 'Floral',
    accent: '#b06a7c',
    border: 'dashed',
    fontSize: 15,
    alignment: 'center',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: '❀ GIFT RECEIPT ❀', tamil: '❀ பரிசு ரசீது ❀', visible: true, textColor: '#b06a7c' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#4a2d36' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#8a7a7f' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#3a232a' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#b06a7c' },
      { id: 'thanks', name: 'Message', kind: 'text', english: 'With love and gratitude', tamil: 'அன்போடும் நன்றியோடும்', visible: true, textColor: '#5c4049' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no} · {date}', tamil: '{receipt_no} · {date}', visible: true, textColor: '#a8969b' },
    ],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    accent: '#2f4858',
    border: 'solid',
    fontSize: 14,
    alignment: 'left',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: 'CONTRIBUTION RECORD', tamil: 'பங்களிப்பு பதிவேடு', visible: true, textColor: '#2f4858' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#16242e' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: 'Contributed by {guest_name}', tamil: '{guest_name} வழங்கியது', visible: true, textColor: '#16242e' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: 'Mode: {payment_mode}', tamil: 'முறை: {payment_mode}', visible: true, textColor: '#5a6b78' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#2f4858' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no} · {date}', tamil: '{receipt_no} · {date}', visible: true, textColor: '#8b98a3' },
    ],
  },
  {
    id: 'executive',
    name: 'Executive',
    accent: '#1b2a3a',
    border: 'solid',
    fontSize: 15,
    alignment: 'left',
    elements: [
      { id: 'header', name: 'Header', kind: 'text', english: 'MUHURTHAM', tamil: 'முகூர்த்தம்', visible: true, textColor: '#1b2a3a' },
      { id: 'function', name: 'Function Name', kind: 'text', english: '{function_name}', tamil: '{function_name}', visible: true, textColor: '#0d141c' },
      { id: 'venue', name: 'Venue', kind: 'text', english: '{venue}', tamil: '{venue}', visible: true, textColor: '#6b7681' },
      { id: 'divider', name: 'Divider', kind: 'divider', english: '', tamil: '', visible: true, textColor: '' },
      { id: 'guest', name: 'Guest Name', kind: 'text', english: '{guest_name}', tamil: '{guest_name}', visible: true, textColor: '#0d141c' },
      { id: 'amount', name: 'Amount', kind: 'text', english: '{amount}', tamil: '{amount}', visible: true, textColor: '#1b2a3a' },
      { id: 'mode', name: 'Payment Mode', kind: 'text', english: '{payment_mode}', tamil: '{payment_mode}', visible: true, textColor: '#6b7681' },
      { id: 'thanks', name: 'Message', kind: 'text', english: 'Every gift, remembered.', tamil: 'ஒவ்வொரு பரிசும் நினைவில்.', visible: true, textColor: '#3d4a56' },
      { id: 'footer', name: 'Footer', kind: 'text', english: '{receipt_no}', tamil: '{receipt_no}', visible: true, textColor: '#98a2ac' },
    ],
  },
]

export const TOKEN_HINTS = [
  '{guest_name}',
  '{amount}',
  '{receipt_no}',
  '{date}',
  '{function_name}',
  '{venue}',
  '{payment_mode}',
  '{organizer}',
]

export const templateById = (id) => DESIGN_TEMPLATES.find((template) => template.id === id) ?? DESIGN_TEMPLATES[0]

export const applyTokens = (value, entry, functionName, venue, organizer = '') =>
  String(value ?? '')
    .replaceAll('{guest_name}', entry?.name ?? 'Guest name')
    .replaceAll('{amount}', entry?.amount != null ? `₹${entry.amount.toLocaleString('en-IN')}` : '₹0')
    .replaceAll('{receipt_no}', entry?.receipt ?? 'R-0000')
    .replaceAll('{date}', entry?.date ? new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today')
    .replaceAll('{function_name}', functionName ?? '')
    .replaceAll('{venue}', venue ?? '')
    .replaceAll('{payment_mode}', entry?.mode ?? 'Cash')
    .replaceAll('{organizer}', organizer || '')

export const paperWidth = (paper) => (paper === '58mm thermal' ? 240 : paper === '80mm thermal' ? 300 : 360)

export default DESIGN_TEMPLATES