import { applyTokens } from '@/lib/design-templates'
import { borderCss, borderDecoration, dividerCss, normalizeHex } from '@/lib/border-styles'
import { cn } from '@/lib/utils'

/**
 * The one renderer for a receipt design.
 *
 * The designer canvas, the receipt preview screen and the printed sheet all go
 * through here, which is what keeps them consistent and stops any layer from
 * being rendered twice.
 */

const alignClass = (value) => `receipt-align-${value || 'inherit'}`

function LayerText({ element, entry, context, design }) {
  const showEnglish = design.language !== 'Tamil'
  const showTamil = design.language !== 'English'
  const english = element.english ? applyTokens(element.english, entry, context.functionName, context.venue, context.organizer) : ''
  const tamil = element.tamil ? applyTokens(element.tamil, entry, context.functionName, context.venue, context.organizer) : ''
  /**
   * Many templates use the same token ({guest_name}, {amount}…) for both
   * languages. Rendering both produced every line twice, so an identical pair
   * collapses into a single line.
   */
  const sameText = Boolean(english) && english === tamil
  const weight = element.weight === 'bold' ? 700 : element.weight === 'normal' ? 400 : undefined
  const base = {
    color: element.textColor || undefined,
    fontWeight: weight,
    textAlign: element.align || undefined,
    letterSpacing: element.letterSpacing != null ? `${element.letterSpacing}px` : undefined,
  }
  return <>
    {showEnglish && english && !sameText ? <span className="receipt-layer-text" style={base}>{english}</span> : null}
    {showTamil && tamil ? <span className="receipt-layer-text tamil-font" style={base}>{tamil}</span> : null}
  </>
}

function Layer({ element, entry, context, design, children }) {
  const style = {
    textAlign: element.align || undefined,
    marginTop: element.spacing ? `${element.spacing}px` : undefined,
  }
  return <div className={cn('receipt-layer', alignClass(element.align))} style={style}>{children}</div>
}

export function ReceiptLayers({ elements, design, entry, functionName, venue, organizer }) {
  const context = { functionName, venue, organizer }
  const visible = (elements ?? []).filter((element) => element.visible !== false && element.kind !== 'image')
  if (!visible.length) return <p className="receipt-layer-empty">No visible layers — pick one from the Layers list.</p>
  return visible.map((element) => {
    if (element.kind === 'divider') {
      return <Layer key={element.id} element={element} entry={entry} context={context} design={design}>
        {element.variant === 'ornamental'
          ? <p className="receipt-ornament-line">❖ ❖ ❖</p>
          : <hr className="receipt-divider" style={{ borderTop: dividerCss(design.border ?? 'solid', element.borderWidth ?? 1, element.borderColor || design.borderColor || design.accent) }} />}
      </Layer>
    }
    if (element.kind === 'spacer') {
      return <Layer key={element.id} element={element} entry={entry} context={context} design={design}>
        <div style={{ height: `${element.height ?? 16}px` }} />
      </Layer>
    }
    return <Layer key={element.id} element={element} entry={entry} context={context} design={design}>
      <LayerText element={element} entry={entry} context={context} design={design} />
    </Layer>
  })
}

/** Frame + logo + background for a design. Shared by canvas and preview. */
export function ReceiptFrame({ design, entry, functionName, venue, organizer, className, children }) {
  const accent = normalizeHex(design.accent)
  const borderColor = design.borderColor || accent
  const width = design.borderWidth ?? 2
  return <article
    className={cn('receipt-paper', `receipt-align-${design.alignment || 'center'}`, className)}
    style={{
      fontSize: design.fontSize ?? 16,
      lineHeight: design.lineHeight ?? 1.5,
      letterSpacing: design.letterSpacing ? `${design.letterSpacing}px` : undefined,
      border: borderCss(design.border ?? 'double', width, borderColor),
      boxShadow: borderDecoration(design.border, width, borderColor),
    }}
  >
    {design.backgroundUrl ? <img src={design.backgroundUrl} alt="" className="receipt-bg" /> : null}
    {design.logoUrl ? <img
      src={design.logoUrl}
      alt="Logo"
      className={cn('receipt-logo', design.logoPosition === 'Left' ? 'receipt-logo-left' : design.logoPosition === 'Right' ? 'receipt-logo-right' : 'receipt-logo-center')}
    /> : null}
    <div className="receipt-inner" style={{ padding: `${design.padding ?? 20}px` }}>
      {children ?? <ReceiptLayers elements={design.elements} design={design} entry={entry} functionName={functionName} venue={venue} organizer={organizer} />}
    </div>
  </article>
}

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

export default ReceiptFrame
