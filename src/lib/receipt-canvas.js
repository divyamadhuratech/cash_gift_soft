import { borderCss, borderDecoration, normalizeHex } from '@/lib/border-styles'

/** Inline style for the designer's on-screen canvas (same rules, screen scale). */
export const canvasPaperStyle = (design) => {
  const accent = normalizeHex(design.accent)
  const borderColor = design.borderColor || accent
  const width = design.borderWidth ?? 2
  return {
    fontSize: design.fontSize ?? 16,
    lineHeight: design.lineHeight ?? 1.5,
    width: design.paper === '58mm thermal' ? 240 : design.paper === '80mm thermal' ? 300 : 360,
    border: borderCss(design.border ?? 'double', width, borderColor),
    boxShadow: borderDecoration(design.border, width, borderColor),
  }
}
