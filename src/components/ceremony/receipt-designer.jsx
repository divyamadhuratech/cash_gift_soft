import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  LayoutTemplate,
  Pencil,
  Plus,
  Printer,
  Redo2,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import { DESIGN_TEMPLATES, TOKEN_HINTS, applyTokens, templateById } from '@/lib/design-templates'
import { BORDER_STYLES, borderCss, hexToRgb, normalizeHex, rgbToHex } from '@/lib/border-styles'
import { uploadsApi, resolveAssetUrl } from '@/lib/ceremony-api'
import { translate } from '@/lib/tamil-ui'
import { canvasPaperStyle } from '@/components/ceremony/receipt-renderer'
import { cn } from '@/lib/utils'

const ALIGN_OPTIONS = [
  { id: 'left', icon: AlignLeft, label: 'Align left' },
  { id: 'center', icon: AlignCenter, label: 'Align centre' },
  { id: 'right', icon: AlignRight, label: 'Align right' },
  { id: 'justify', icon: AlignJustify, label: 'Justify' },
]

const SWATCHES = ['#b28e3e', '#0f4d3a', '#9b7024', '#b06a7c', '#2f4858', '#bd6c65', '#1b2a3a', '#6a8b65', '#8c3f57', '#2f6f6f']
const RECENT_LIMIT = 8

/**
 * The receipt design tool.
 *
 * It is fully controlled: `design` is the single source of truth and every edit
 * reports a new object through `onChange`. That is what lets the same tool be
 * embedded as wizard step 6 and still be reachable from its own route.
 */
export function ReceiptDesigner({ design, onChange, onSave, functionName = '', venue = '', organizer = '', entry = null, uiLanguage = 'English' }) {
  const t = useCallback((text) => translate(text, uiLanguage), [uiLanguage])
  const [selectedId, setSelectedId] = useState('')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [accentOpen, setAccentOpen] = useState(false)
  const [borderOpen, setBorderOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [recentColours, setRecentColours] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('muhurtham-recent-colours') ?? '[]') } catch { return [] }
  })
  const logoInput = useRef(null)
  const backgroundInput = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
  const [historyState, setHistoryState] = useState({ past: 0, future: 0 })

  const elements = design.elements ?? []
  // Derived rather than stored so deleting a layer can never leave a stale id.
  const selected = elements.find((element) => element.id === selectedId) ?? elements[0] ?? null
  const activeId = selected?.id ?? ''

  /** Every mutation records the previous design so undo/redo stay in step. */
  const emit = useCallback((next) => {
    historyRef.current = { past: [...historyRef.current.past.slice(-40), design], future: [] }
    setHistoryState({ past: historyRef.current.past.length, future: 0 })
    onChange(next)
  }, [design, onChange])

  const doUndo = useCallback(() => {
    const { past, future } = historyRef.current
    if (!past.length) return
    const previous = past[past.length - 1]
    historyRef.current = { past: past.slice(0, -1), future: [design, ...future].slice(0, 40) }
    setHistoryState({ past: historyRef.current.past.length, future: historyRef.current.future.length })
    onChange(previous)
  }, [design, onChange])

  const doRedo = useCallback(() => {
    const { past, future } = historyRef.current
    if (!future.length) return
    const next = future[0]
    historyRef.current = { past: [...past, design].slice(-40), future: future.slice(1) }
    setHistoryState({ past: historyRef.current.past.length, future: historyRef.current.future.length })
    onChange(next)
  }, [design, onChange])

  const patch = useCallback((changes) => emit({ ...design, ...changes }), [design, emit])
  const patchElement = useCallback((id, changes) => {
    emit({ ...design, elements: (design.elements ?? []).map((element) => (element.id === id ? { ...element, ...changes } : element)) })
  }, [design, emit])

  const rememberColour = useCallback((colour) => {
    setRecentColours((current) => {
      const next = [colour, ...current.filter((item) => item !== colour)].slice(0, RECENT_LIMIT)
      try { window.localStorage.setItem('muhurtham-recent-colours', JSON.stringify(next)) } catch { return next }
      return next
    })
  }, [])

  function move(id, direction) {
    const from = elements.findIndex((element) => element.id === id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= elements.length) return
    const next = [...elements]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    emit({ ...design, elements: next.map((element, order) => ({ ...element, order })) })
  }

  function duplicateElement(id) {
    const source = elements.find((element) => element.id === id)
    if (!source) return
    const index = elements.findIndex((element) => element.id === id)
    const copyId = `${source.id}-copy-${Date.now().toString(36).slice(-3)}`
    const copy = { ...source, id: copyId, name: `${source.name} copy` }
    const next = [...elements]
    next.splice(index + 1, 0, copy)
    emit({ ...design, elements: next.map((element, order) => ({ ...element, order })) })
    setSelectedId(copyId)
  }

  function removeElement(id) {
    if (elements.length <= 1) return
    const next = elements.filter((element) => element.id !== id)
    emit({ ...design, elements: next.map((element, order) => ({ ...element, order })) })
    if (activeId === id) setSelectedId(next[0]?.id ?? '')
  }

  function addElement(kind, name, text) {
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`
    const next = [...elements, { id, name, kind, english: text, tamil: '', visible: true, textColor: '', align: '', weight: '', spacing: 0, height: kind === 'spacer' ? 16 : undefined, order: elements.length }]
    emit({ ...design, elements: next })
    setSelectedId(id)
  }

  function applyTemplate(id) {
    const template = templateById(id)
    const seen = new Set()
    const next = []
    template.elements.forEach((element, order) => {
      const elementId = element.id ?? `${element.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${order}`
      if (seen.has(elementId)) return
      seen.add(elementId)
      next.push({ ...element, id: elementId, align: element.align ?? '', weight: element.weight ?? '', spacing: element.spacing ?? 0, order })
    })
    emit({
      ...design,
      template: template.name,
      accent: template.accent,
      border: template.border,
      borderColor: template.accent,
      borderWidth: template.border === 'double' ? 3 : 2,
      fontSize: template.fontSize,
      alignment: template.alignment,
      elements: next,
    })
    setTemplatesOpen(false)
    setSelectedId(next[0]?.id ?? '')
    setNotice(`${template.name} template applied.`)
  }

  async function uploadImage(file, kind) {
    if (!file?.type.startsWith('image/')) {
      setNotice('That file is not an image.')
      return
    }
    setBusy(true)
    const preview = URL.createObjectURL(file)
    patch(kind === 'logo' ? { logoUrl: preview } : { backgroundUrl: preview })
    try {
      const asset = await uploadsApi.upload(file, kind)
      patch(kind === 'logo' ? { logoUrl: resolveAssetUrl(asset.url) } : { backgroundUrl: resolveAssetUrl(asset.url) })
      setNotice('Image uploaded.')
    } catch {
      setNotice('Kept as a local preview — the image server is offline.')
    } finally {
      setBusy(false)
    }
  }

  function commitAccent(value) {
    const colour = normalizeHex(value, design.accent)
    patch({ accent: colour })
    rememberColour(colour)
  }

  const showEnglish = design.language !== 'Tamil'
  const showTamil = design.language !== 'English'
  const accent = normalizeHex(design.accent)
  const borderColor = design.borderColor || accent

  return <div className="flex flex-col gap-4">
    <Toolbar
      t={t}
      design={design}
      patch={patch}
      templatesOpen={templatesOpen}
      setTemplatesOpen={setTemplatesOpen}
      onApplyTemplate={applyTemplate}
      onAdd={() => addElement('text', 'Custom text', 'Your message')}
      onDivider={() => addElement('divider', 'Divider', '')}
      onSpacer={() => addElement('spacer', 'Spacer', '')}
      onSave={() => { onSave?.(); setNotice('Design saved.') }}
      onPrint={() => { onSave?.(); setNotice('Test receipt is ready to print.'); window.print() }}
      onDuplicate={() => { if (selected) duplicateElement(selected.id) }}
      hasSelection={Boolean(selected)}
      onUndo={doUndo}
      onRedo={doRedo}
      canUndo={historyState.past > 0}
      canRedo={historyState.future > 0}
    />

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(220px,268px)_minmax(0,1fr)_minmax(300px,360px)]">
      <LayersPanel
        t={t}
        elements={elements}
        selectedId={activeId}
        onSelect={setSelectedId}
        onMove={move}
        onToggle={(element) => patchElement(element.id, { visible: element.visible === false })}
        onDelete={removeElement}
        onAdd={() => addElement('text', 'Custom text', 'Your message')}
      />

      <section className="min-w-0 rounded-[22px] border border-border bg-[#eeece3] p-4 shadow-[0_7px_28px_#25291a08] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t('Live canvas')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{design.paper} · {entry?.name ?? t('Sample guest')}</p>
          </div>
          <select value={design.paper} onChange={(event) => patch({ paper: event.target.value })} className="form-select min-h-11 w-auto" aria-label={t('Paper size')}>
            {['A6', '80mm thermal', '58mm thermal'].map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>

        <div className="flex justify-center overflow-auto rounded-xl p-3">
          <div className="receipt-paper relative bg-white shadow-xl" style={canvasPaperStyle(design)}>
            {design.backgroundUrl ? <img src={design.backgroundUrl} alt="" className="receipt-bg" /> : null}
            {design.logoUrl ? <img src={design.logoUrl} alt="Logo" className={cn('receipt-logo', design.logoPosition === 'Left' ? 'receipt-logo-left' : design.logoPosition === 'Right' ? 'receipt-logo-right' : 'receipt-logo-center')} /> : null}
            <div
              className="relative z-10"
              style={{ padding: `${design.padding ?? 20}px`, fontSize: design.fontSize ?? 16, lineHeight: design.lineHeight ?? 1.5, textAlign: design.alignment ?? 'center' }}
            >
              {elements.length === 0 && <p className="receipt-layer-empty">{t('Add a layer to start designing.')}</p>}
              {elements.map((element) => {
                if (element.visible === false) return null
                const active = activeId === element.id
                const editing = editingId === element.id
                const elementAlign = element.align || design.alignment || 'center'
                return <div
                  key={element.id}
                  className={cn('receipt-layer receipt-layer-hit', active && 'receipt-layer-active')}
                  style={{ textAlign: elementAlign, marginTop: element.spacing ? `${element.spacing}px` : undefined }}
                  onClick={() => setSelectedId(element.id)}
                  onDoubleClick={() => element.kind === 'text' && setEditingId(element.id)}
                >
                  {editing && element.kind === 'text'
                    ? <textarea
                      autoFocus
                      className="receipt-layer-edit"
                      rows={Math.max(2, Math.ceil((element.english?.length || 8) / 26))}
                      value={showEnglish ? (element.english ?? '') : (element.tamil ?? '')}
                      onChange={(event) => patchElement(element.id, showEnglish ? { english: event.target.value } : { tamil: event.target.value })}
                      onBlur={() => setEditingId('')}
                      onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(''); if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) setEditingId('') }}
                    />
                    : <span
                      role="button"
                      tabIndex={0}
                      className="block"
                      onKeyDown={(event) => { if (element.kind === 'text' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setEditingId(element.id) } }}
                    >
                      {element.kind === 'divider'
                        ? (element.variant === 'ornamental'
                          ? <p className="receipt-ornament-line">❖ ❖ ❖</p>
                          : <hr className="receipt-divider" style={{ borderTop: `${Math.max(element.borderWidth ?? 1, 1)}px ${element.borderStyle || design.border || 'solid'} ${element.borderColor || borderColor}` }} />)
                        : null}
                      {element.kind === 'spacer' ? <div style={{ height: `${element.height ?? 16}px` }} /> : null}
                      {element.kind === 'text' ? (() => {
                        const englishText = showEnglish && element.english ? applyTokens(element.english, entry, functionName, venue, organizer) : ''
                        const tamilText = showTamil && element.tamil ? applyTokens(element.tamil, entry, functionName, venue, organizer) : ''
                        const sameText = Boolean(englishText) && englishText === tamilText
                        const style = { color: element.textColor || undefined, fontWeight: element.weight === 'bold' ? 700 : element.weight === 'normal' ? 400 : 600 }
                        return <>
                          {englishText && !sameText ? <span className="receipt-layer-text" style={style}>{englishText}</span> : null}
                          {tamilText ? <span className="receipt-layer-text tamil-font" style={style}>{tamilText}</span> : null}
                          {!englishText && !tamilText ? <span className="receipt-layer-text text-muted-foreground">{t('Custom text')}</span> : null}
                        </>
                      })() : null}
                    </span>}
                </div>
              })}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {t('Double click a line on the canvas to type directly.')}
        </p>
      </section>

      <Inspector
        t={t}
        design={design}
        selected={selected}
        patch={patch}
        patchElement={patchElement}
        accent={accent}
        borderColor={borderColor}
        accentOpen={accentOpen}
        setAccentOpen={setAccentOpen}
        borderOpen={borderOpen}
        setBorderOpen={setBorderOpen}
        recentColours={recentColours}
        onCommitAccent={commitAccent}
        rememberColour={rememberColour}
        busy={busy}
        logoInput={logoInput}
        backgroundInput={backgroundInput}
        onUpload={uploadImage}
        onDuplicate={() => selected && duplicateElement(selected.id)}
        onDelete={() => selected && removeElement(selected.id)}
        onEditCanvas={() => setEditingId(selected?.id ?? '')}
        canDelete={elements.length > 1}
      />
    </div>

    <p role="status" className="text-sm text-muted-foreground">
      {notice || t('Changes stay on this function until you save.')}
      {busy ? ' · uploading…' : ''}
    </p>
  </div>
}

function Toolbar({ t, design, patch, templatesOpen, setTemplatesOpen, onApplyTemplate, onAdd, onDivider, onSpacer, onSave, onPrint, onDuplicate, hasSelection, onUndo, onRedo, canUndo, canRedo }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-border bg-card p-3 shadow-[0_7px_28px_#25291a08]">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onUndo} disabled={!canUndo} className="icon-button" aria-label={t('Undo')}><Undo2 /></button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="icon-button" aria-label={t('Redo')}><Redo2 /></button>
      <div className="relative">
        <button type="button" onClick={() => setTemplatesOpen((value) => !value)} className="soft-action" aria-expanded={templatesOpen}>
          <LayoutTemplate className="size-4" />{t('Templates')}
        </button>
        {templatesOpen && <div className="absolute left-0 top-12 z-30 grid w-[min(92vw,32rem)] grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3 shadow-2xl sm:grid-cols-4">
          {DESIGN_TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => onApplyTemplate(template.id)} className={cn('rounded-xl border p-2 text-left transition', design.template === template.name ? 'border-primary ring-2 ring-primary/25' : 'border-border hover:border-primary/40')}><TemplateThumb template={template} /><span className="mt-1.5 block text-xs font-semibold">{template.name}</span></button>)}
        </div>}
      </div>
      <button type="button" onClick={onAdd} className="soft-action"><Type className="size-4" />{t('Add text')}</button>
      <button type="button" onClick={onDivider} className="soft-action"><Sparkles className="size-4" />{t('Divider')}</button>
      <button type="button" onClick={onSpacer} className="soft-action"><Plus className="size-4" />{t('Spacer')}</button>
      <button type="button" onClick={onDuplicate} disabled={!hasSelection} className="soft-action disabled:opacity-40"><Copy className="size-4" />{t('Duplicate')}</button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select value={design.language} onChange={(event) => patch({ language: event.target.value })} className="form-select min-h-11 w-auto" aria-label={t('Preview language')}>
        {['English', 'Tamil', 'Both'].map((option) => <option key={option}>{option}</option>)}
      </select>
      <button type="button" onClick={onSave} className="primary-action"><Save className="size-4" />{t('Save')}</button>
      <button type="button" onClick={onPrint} className="secondary-action"><Printer className="size-4" />{t('Print test')}</button>
    </div>
  </div>
}

function LayersPanel({ t, elements, selectedId, onSelect, onMove, onToggle, onDelete, onAdd }) {
  return <section className="rounded-[22px] border border-border bg-card p-4 shadow-[0_7px_28px_#25291a08]">
    <div className="designer-panel-title">
      <span>{t('Layers')}</span>
      <button type="button" onClick={onAdd} className="text-primary" aria-label={t('Add text')}><Plus className="size-4" /></button>
    </div>
    <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
      {elements.map((element) => <div
        key={element.id}
        className={cn('flex min-h-12 w-full items-center gap-1 rounded-xl border px-2 text-left transition', selectedId === element.id ? 'border-primary bg-primary/6' : 'border-border bg-background hover:border-primary/40')}
      >
        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
        <button type="button" onClick={() => onSelect(element.id)} className="min-w-0 flex-1 py-2 text-left">
          <span className="block truncate text-xs font-semibold">{element.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{element.kind}</span>
        </button>
        <button type="button" onClick={() => onMove(element.id, -1)} className="p-1 text-muted-foreground" aria-label={t('Move up')}><ArrowUp className="size-3" /></button>
        <button type="button" onClick={() => onMove(element.id, 1)} className="p-1 text-muted-foreground" aria-label={t('Move down')}><ArrowDown className="size-3" /></button>
        <button type="button" onClick={() => onToggle(element)} className="p-1 text-muted-foreground" aria-label={element.visible === false ? t('Show layer') : t('Hide layer')}>
          {element.visible === false ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
        </button>
        <button type="button" onClick={() => onDelete(element.id)} className="p-1 text-muted-foreground" aria-label={t('Delete layer')}><Trash2 className="size-3" /></button>
      </div>)}
      {elements.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t('Add a layer to start designing.')}</p>}
    </div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{t('Click a layer, then edit it here or on the canvas.')}</p>
  </section>
}

function Inspector({ t, design, selected, patch, patchElement, accent, borderColor, accentOpen, setAccentOpen, borderOpen, setBorderOpen, recentColours, onCommitAccent, rememberColour, busy, logoInput, backgroundInput, onUpload, onDuplicate, onDelete, onEditCanvas, canDelete }) {
  const [hexDraft, setHexDraft] = useState(accent)
  const rgb = useMemo(() => hexToRgb(accent), [accent])
  useEffect(() => setHexDraft(accent), [accent])

  return <section className="rounded-[22px] border border-border bg-card p-5 shadow-[0_7px_28px_#25291a08]">
    <div className="designer-panel-title"><span>{t('Inspector')}</span><SlidersHorizontal className="size-3.5" /></div>

    <label className="form-label" htmlFor="design-name">{t('Design name')}</label>
    <input id="design-name" className="form-input mb-4" value={design.name ?? ''} onChange={(event) => patch({ name: event.target.value })} />

    <Accordion title={t('Paper')} open={false}>
      <div className="grid grid-cols-2 gap-2">
        <select value={design.paper} onChange={(event) => patch({ paper: event.target.value })} className="form-select min-h-10 text-xs" aria-label={t('Paper size')}>
          {['A6', '80mm thermal', '58mm thermal'].map((option) => <option key={option}>{option}</option>)}
        </select>
        <select value={design.alignment ?? 'center'} onChange={(event) => patch({ alignment: event.target.value })} className="form-select min-h-10 text-xs" aria-label={t('Alignment')}>
          {ALIGN_OPTIONS.map((option) => <option key={option.id} value={option.id}>{t(option.label)}</option>)}
        </select>
      </div>
      <RangeRow t={t} label={t('Font size')} value={design.fontSize ?? 16} min={10} max={30} step={1} suffix="px" onChange={(value) => patch({ fontSize: value })} />
      <RangeRow t={t} label={t('Line height')} value={design.lineHeight ?? 1.5} min={1} max={2.4} step={0.05} onChange={(value) => patch({ lineHeight: value })} />
      <RangeRow t={t} label={t('Padding')} value={design.padding ?? 20} min={8} max={48} step={1} suffix="px" onChange={(value) => patch({ padding: value })} />
    </Accordion>

    <Accordion title={t('Accent colour')} open={accentOpen} onToggle={() => setAccentOpen((value) => !value)}>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((colour) => <button key={colour} type="button" onClick={() => onCommitAccent(colour)} aria-label={`${t('Accent colour')} ${colour}`} className={cn('size-8 rounded-full border-2 border-card ring-1', accent === colour ? 'ring-2 ring-primary' : 'ring-border')} style={{ backgroundColor: colour }} />)}
        <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border-2 border-card ring-1 ring-border" style={{ background: `conic-gradient(#e11, #ff0, #0f0, #0ff, #00f, #f0f, #e11)` }} title={t('Use the colour picker')}>
          <input type="color" className="color-swatch-input" value={accent} onChange={(event) => onCommitAccent(event.target.value)} aria-label={t('Pick a colour')} />
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <span className="text-[10px] font-bold text-muted-foreground">{t('HEX')}</span>
          <input
            value={hexDraft}
            onChange={(event) => setHexDraft(event.target.value)}
            onBlur={() => { if (/^#?[0-9a-f]{3,8}$/i.test(hexDraft.trim())) { onCommitAccent(hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`) } else setHexDraft(accent) }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
            className="w-full bg-transparent text-xs outline-none"
            aria-label={t('HEX')}
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <span className="text-[10px] font-bold text-muted-foreground">{t('RGB')}</span>
          <input
            type="number"
            value={rgb.r}
            onChange={(event) => { const next = rgbToHex(event.target.value, rgb.g, rgb.b); rememberColour(next); onCommitAccent(next) }}
            className="w-full bg-transparent text-xs outline-none"
            aria-label={`${t('RGB')} R`}
          />
          <input
            type="number"
            value={rgb.g}
            onChange={(event) => { const next = rgbToHex(rgb.r, event.target.value, rgb.b); rememberColour(next); onCommitAccent(next) }}
            className="w-full bg-transparent text-xs outline-none"
            aria-label={`${t('RGB')} G`}
          />
          <input
            type="number"
            value={rgb.b}
            onChange={(event) => { const next = rgbToHex(rgb.r, rgb.g, event.target.value); rememberColour(next); onCommitAccent(next) }}
            className="w-full bg-transparent text-xs outline-none"
            aria-label={`${t('RGB')} B`}
          />
        </label>
      </div>
      {recentColours.length > 0 && <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('Recent colours')}</p>}
      {recentColours.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{recentColours.map((colour) => <button key={colour} type="button" onClick={() => onCommitAccent(colour)} aria-label={colour} className="size-6 rounded-md border border-border" style={{ backgroundColor: colour }} />)}</div>}
    </Accordion>

    <Accordion title={t('Border')} open={borderOpen} onToggle={() => setBorderOpen((value) => !value)}>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {BORDER_STYLES.map((option) => <button
          key={option.id}
          type="button"
          onClick={() => patch({ border: option.id })}
          aria-pressed={design.border === option.id}
          className={cn('designer-option flex-col gap-1 py-1.5', design.border === option.id && 'designer-option-active')}
        >
          <span className="block h-4 w-7 rounded-[3px]" style={{ border: borderCss(option.id, 2, borderColor) }} />
          <span className="text-[10px]">{t(option.label)}</span>
        </button>)}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <label className="relative size-9 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: borderColor }} title={t('Pick a colour')}>
          <input type="color" className="color-swatch-input" value={borderColor} onChange={(event) => patch({ borderColor: event.target.value })} aria-label={t('Border colour')} />
        </label>
        <input
          value={borderColor}
          onChange={(event) => patch({ borderColor: event.target.value })}
          onBlur={() => patch({ borderColor: normalizeHex(design.borderColor, accent) })}
          className="form-input min-h-9 flex-1 text-xs"
          aria-label={t('Border colour')}
        />
      </div>
      <RangeRow t={t} label={t('Thickness')} value={design.borderWidth ?? 2} min={0} max={10} step={1} suffix="px" onChange={(value) => patch({ borderWidth: value })} />
    </Accordion>

    <Accordion title={t('Logo')} open={false}>
      <div className="grid gap-2">
        <button type="button" onClick={() => logoInput.current?.click()} disabled={busy} className="secondary-action min-h-11 justify-start text-xs"><ImagePlus className="size-4" />{design.logoUrl ? t('Replace logo') : t('Upload logo')}</button>
        <button type="button" onClick={() => backgroundInput.current?.click()} disabled={busy} className="secondary-action min-h-11 justify-start text-xs"><ImagePlus className="size-4" />{design.backgroundUrl ? t('Replace background') : t('Upload background')}</button>
        <div className="flex gap-2">
          {design.logoUrl && <button type="button" onClick={() => patch({ logoUrl: '' })} className="soft-action min-h-10 flex-1 text-xs"><Trash2 className="size-3.5" />{t('Remove logo')}</button>}
          {design.backgroundUrl && <button type="button" onClick={() => patch({ backgroundUrl: '' })} className="soft-action min-h-10 flex-1 text-xs"><Trash2 className="size-3.5" />{t('Remove background')}</button>}
        </div>
        <select value={design.logoPosition ?? 'Center'} onChange={(event) => patch({ logoPosition: event.target.value })} className="form-select min-h-11" aria-label={t('Logo position')}>
          {['Left', 'Center', 'Right'].map((option) => <option key={option}>{option}</option>)}
        </select>
        <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(event) => onUpload(event.target.files?.[0], 'logo')} />
        <input ref={backgroundInput} type="file" accept="image/*" className="hidden" onChange={(event) => onUpload(event.target.files?.[0], 'background')} />
      </div>
    </Accordion>

    <div className="mt-5 rounded-2xl border border-border bg-secondary/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">{t('Selected layer')}</p>
        {selected && <p className="truncate text-xs font-semibold">{selected.name}</p>}
      </div>
      {!selected
        ? <p className="text-xs text-muted-foreground">{t('This layer has no text.')}</p>
        : <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={onEditCanvas} className="soft-action min-h-9 px-2 text-[11px]"><Pencil className="size-3.5" />{t('Custom text')}</button>
            <button type="button" onClick={onDuplicate} className="soft-action min-h-9 px-2 text-[11px]"><Copy className="size-3.5" />{t('Duplicate')}</button>
            <button type="button" onClick={onDelete} disabled={!canDelete} className="soft-action min-h-9 px-2 text-[11px] disabled:opacity-40"><Trash2 className="size-3.5" />{t('Delete layer')}</button>
          </div>
          {selected.kind === 'text' ? <>
            <label className="form-label" htmlFor="layer-english">{t('English text')}</label>
            <textarea id="layer-english" className="form-input min-h-20 resize-y" value={selected.english ?? ''} onChange={(event) => patchElement(selected.id, { english: event.target.value })} />
            <div className="mt-2 flex flex-wrap gap-1">{TOKEN_HINTS.map((hint) => <button key={hint} type="button" onClick={() => patchElement(selected.id, { english: `${selected.english ?? ''}${selected.english ? ' ' : ''}${hint}` })} className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:border-primary">{hint}</button>)}</div>
            <label className="form-label mt-4" htmlFor="layer-tamil">{t('Tamil text')}</label>
            <textarea id="layer-tamil" className="form-input min-h-20 resize-y tamil-font" value={selected.tamil ?? ''} onChange={(event) => patchElement(selected.id, { tamil: event.target.value })} />
            <p className="mt-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('Text colour')}</p>
            <div className="flex items-center gap-2">
              <label className="relative size-9 cursor-pointer overflow-hidden rounded-lg border border-border" style={{ background: normalizeHex(selected.textColor, accent) }} title={t('Pick a colour')}>
                <input type="color" className="color-swatch-input" value={normalizeHex(selected.textColor, accent)} onChange={(event) => patchElement(selected.id, { textColor: event.target.value })} aria-label={t('Text colour')} />
              </label>
              <button type="button" onClick={() => patchElement(selected.id, { textColor: '' })} className="soft-action min-h-9 px-2 text-[11px]"><X className="size-3.5" />{t('None')}</button>
            </div>
            <p className="mt-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('Alignment')}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ALIGN_OPTIONS.map((option) => {
                const Icon = option.icon
                const value = selected.align || design.alignment || 'center'
                return <button key={option.id} type="button" title={t(option.label)} aria-label={t(option.label)} aria-pressed={value === option.id} onClick={() => patchElement(selected.id, { align: selected.align === option.id ? '' : option.id })} className={cn('designer-option', value === option.id && 'designer-option-active')}><Icon className="size-4" /></button>
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {['bold', 'normal'].map((weight) => <button key={weight} type="button" aria-pressed={selected.weight === weight} onClick={() => patchElement(selected.id, { weight: selected.weight === weight ? '' : weight })} className={cn('designer-option capitalize', selected.weight === weight && 'designer-option-active')}>{t(weight === 'bold' ? 'Bold' : 'Normal')}</button>)}
            </div>
            <RangeRow t={t} label={t('Spacing')} value={selected.spacing ?? 0} min={-12} max={48} step={1} suffix="px" onChange={(value) => patchElement(selected.id, { spacing: value })} />
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={selected.visible !== false} onChange={(event) => patchElement(selected.id, { visible: event.target.checked })} className="size-4 accent-primary" />
              {t('Visible on the printed receipt')}
            </label>
          </> : <>
            {selected.kind === 'divider' && <>
              <label className="form-label" htmlFor="divider-style">{t('Border style')}</label>
              <select id="divider-style" value={selected.borderStyle ?? design.border ?? 'solid'} onChange={(event) => patchElement(selected.id, { borderStyle: event.target.value })} className="form-select min-h-10 text-xs">
                {BORDER_STYLES.map((option) => <option key={option.id} value={option.id}>{t(option.label)}</option>)}
              </select>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={selected.variant === 'ornamental'} onChange={(event) => patchElement(selected.id, { variant: event.target.checked ? 'ornamental' : 'line' })} className="size-4 accent-primary" />
                ❖ {t('Decorative')}
              </label>
              <RangeRow t={t} label={t('Thickness')} value={selected.borderWidth ?? 1} min={1} max={8} step={1} suffix="px" onChange={(value) => patchElement(selected.id, { borderWidth: value })} />
            </>}
            {selected.kind === 'spacer' && <RangeRow t={t} label={t('Line height')} value={selected.height ?? 16} min={4} max={80} step={2} suffix="px" onChange={(value) => patchElement(selected.id, { height: value })} />}
            {selected.kind !== 'divider' && selected.kind !== 'spacer' && <p className="text-xs text-muted-foreground">{t('This layer has no text.')}</p>}
          </>}
        </>}
    </div>
  </section>
}

function Accordion({ title, open, onToggle, children }) {
  const [internalOpen, setInternalOpen] = useState(Boolean(open))
  const expanded = onToggle ? open : internalOpen
  const toggle = onToggle ?? (() => setInternalOpen((value) => !value))
  return <div className="mb-3 border-b border-border pb-3">
    <button type="button" onClick={toggle} aria-expanded={expanded} className="flex w-full items-center justify-between gap-2 py-2 text-left text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">
      {title}
      <span className={cn('transition-transform', expanded && 'rotate-180')}>▾</span>
    </button>
    {expanded && <div className="pt-1">{children}</div>}
  </div>
}

function RangeRow({ label, value, min, max, step, suffix, onChange }) {
  return <label className="mt-3 block">
    <span className="mb-1 flex items-center justify-between text-xs font-semibold"><span>{label}</span><span className="font-normal text-muted-foreground">{value}{suffix}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-primary" />
  </label>
}

function TemplateThumb({ template }) {
  return <div className="flex h-20 items-center justify-center rounded-lg bg-[#f1eee4] p-2">
    <div className="flex h-full w-14 flex-col items-center justify-center gap-1 bg-white p-1.5 text-center" style={{ border: borderCss(template.border, 2, template.accent) }}>
      <span className="h-1 w-6 rounded" style={{ backgroundColor: template.accent }} />
      <span className="h-px w-7 bg-black/15" />
      <span className="h-1.5 w-5 rounded bg-black/20" />
      <span className="h-2 w-7 rounded" style={{ backgroundColor: `${template.accent}33` }} />
      <span className="h-1 w-6 rounded bg-black/10" />
    </div>
  </div>
}

export default ReceiptDesigner
