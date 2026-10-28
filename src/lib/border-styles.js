/**
 * Single source of truth for turning a border style choice into CSS so the
 * designer canvas, the receipt preview and the printed sheet always match.
 */

export const BORDER_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'solid', label: 'Solid' },
  { id: 'double', label: 'Double' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'thick', label: 'Thick' },
  { id: 'groove', label: 'Groove' },
  { id: 'ridge', label: 'Ridge' },
  { id: 'inset', label: 'Inset' },
  { id: 'outset', label: 'Outset' },
  { id: 'decorative', label: 'Decorative' },
]

const fallbackColor = '#b28e3e'

const safeWidth = (width) => {
  const value = Number(width)
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 12) : 2
}

export const normalizeHex = (value, fallback = fallbackColor) => {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback
  const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map((part) => Math.min(Math.max(Number(part), 0), 255))
    return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`
  }
  if (/^#([0-9a-f]{3})$/i.test(raw)) {
    const [, hex] = raw.match(/^#([0-9a-f]{3})$/i)
    return `#${hex.split('').map((char) => char + char).join('')}`.toLowerCase()
  }
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase()
  return fallback
}

export const hexToRgb = (hex) => {
  const clean = normalizeHex(hex).slice(1)
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((part) => Math.min(Math.max(Number(part) || 0, 0), 255).toString(16).padStart(2, '0')).join('')}`

/** CSS `border` shorthand for the receipt frame. */
export function borderCss(style = 'double', width = 2, color = fallbackColor) {
  const size = safeWidth(width)
  const stroke = normalizeHex(color)
  switch (style) {
    case 'none': return 'none'
    case 'double': return `${size * 2}px double ${stroke}`
    case 'dashed': return `${size}px dashed ${stroke}`
    case 'dotted': return `${size}px dotted ${stroke}`
    case 'thick': return `${size + 2}px solid ${stroke}`
    case 'groove': return `${size + 1}px groove ${stroke}`
    case 'ridge': return `${size + 1}px ridge ${stroke}`
    case 'inset': return `${size}px inset ${stroke}`
    case 'outset': return `${size}px outset ${stroke}`
    case 'decorative': return `${size}px solid ${stroke}`
    default: return `${size}px solid ${stroke}`
  }
}

/** Extra paint that only the decorative frame needs. */
export function borderDecoration(style, width = 2, color = fallbackColor) {
  if (style !== 'decorative') return undefined
  const stroke = normalizeHex(color)
  const gap = safeWidth(width) + 2
  return `inset 0 0 0 ${gap}px ${stroke}, inset 0 0 0 ${gap + 3}px #ffffff, inset 0 0 0 ${gap + 5}px ${stroke}`
}

/** CSS `border-top` for divider layers, which follow the same style list. */
export function dividerCss(style = 'solid', width = 1, color = fallbackColor) {
  if (style === 'none') return 'none'
  const stroke = normalizeHex(color)
  const size = Math.max(safeWidth(width), 1)
  switch (style) {
    case 'double': return `${size * 2}px double ${stroke}`
    case 'dashed': return `${size}px dashed ${stroke}`
    case 'dotted': return `${size}px dotted ${stroke}`
    case 'decorative': return `${size}px solid ${stroke}`
    case 'thick': return `${size + 1}px solid ${stroke}`
    default: return `${size}px ${style} ${stroke}`
  }
}

export default BORDER_STYLES
