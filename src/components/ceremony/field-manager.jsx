import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'

const typeOptions = [
  { value: 'text', label: 'Short text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
]

const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32)

export function FieldManager({ fields, onChange, catalog = [], max = 12, addLabel = 'Add field', emptyHint = 'Every input you remove here disappears from the form.' }) {
  const [draftLabel, setDraftLabel] = useState('')
  const [draftType, setDraftType] = useState('text')
  const [error, setError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const usedKeys = new Set(fields.map((field) => field.key))
  const available = catalog.filter((item) => !usedKeys.has(item.key))
  const atLimit = fields.length >= max

  function onDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = fields.findIndex((field) => field.key === active.id)
    const to = fields.findIndex((field) => field.key === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(fields, from, to))
  }

  function move(key, direction) {
    const from = fields.findIndex((field) => field.key === key)
    const to = from + direction
    if (from < 0 || to < 0 || to >= fields.length) return
    onChange(arrayMove(fields, from, to))
  }

  function update(key, patch) {
    onChange(fields.map((field) => (field.key === key ? { ...field, ...patch } : field)))
  }

  function remove(key) {
    onChange(fields.filter((field) => field.key !== key))
  }

  function addCustom() {
    const label = draftLabel.trim()
    if (!label) return setError('Give the field a name first')
    if (atLimit) return setError(`You can keep up to ${max} fields`)
    const key = slugify(label)
    if (!key) return setError('Use at least one letter or number')
    if (usedKeys.has(key)) return setError(`"${label}" already exists`)
    onChange([...fields, { key, label, tamil: '', type: draftType, options: [], required: false, removable: true, builtin: false }])
    setDraftLabel('')
    setError('')
  }

  return <div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">Drag to set the order</h3>
        <p className="mt-1 text-xs text-muted-foreground">Works with a mouse or your finger. Arrow buttons work too.</p>
      </div>
      <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">{fields.length}/{max} fields</span>
    </div>

    <DndContext id="field-manager" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={fields.map((field) => field.key)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <SortableFieldRow
              key={field.key}
              field={field}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              onMove={(direction) => move(field.key, direction)}
              onRemove={() => remove(field.key)}
              onPatch={(patch) => update(field.key, patch)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>

    {fields.length === 0 && <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{emptyHint}</p>}

    <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{addLabel}</p>

      {available.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
        {available.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={atLimit}
            onClick={() => onChange([...fields, { ...item, removable: item.removable !== false }])}
            className="secondary-action min-h-10 px-3 text-xs disabled:opacity-40"
          >
            <Plus className="size-3.5" />{item.label}
          </button>
        ))}
      </div>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="form-input min-h-12"
          value={draftLabel}
          onChange={(event) => { setDraftLabel(event.target.value); setError('') }}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }}
          placeholder="Custom field name, e.g. Blessing note"
        />
        <select className="form-select min-h-12 sm:w-44" value={draftType} onChange={(event) => setDraftType(event.target.value)}>
          {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" onClick={addCustom} disabled={atLimit || !draftLabel.trim()} className="primary-action shrink-0 px-4"><Plus className="size-4" />Add</button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  </div>
}

function SortableFieldRow({ field, isFirst, isLast, onMove, onRemove, onPatch }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }

  return <div ref={setNodeRef} style={style} className="flex min-h-[62px] items-center gap-1.5 rounded-xl border border-border bg-card px-2">
    <button type="button" {...attributes} {...listeners} aria-label={`Drag ${field.label}`} className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground active:cursor-grabbing">
      <GripVertical className="size-4" />
    </button>

    <div className="min-w-0 flex-1 py-1.5">
      <input
        className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold outline-none transition focus:border-primary/40 focus:bg-background"
        value={field.label}
        onChange={(event) => onPatch({ label: event.target.value })}
        aria-label={`Label for ${field.key}`}
      />
      <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-0.5">
        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{field.key}</span>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{field.type}</span>
        {field.required && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">required</span>}
        {field.builtin && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">built-in</span>}
        <label className="ml-1 inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-muted-foreground">
          <input type="checkbox" className="size-3 accent-primary" checked={field.required} onChange={(event) => onPatch({ required: event.target.checked })} />
          Required
        </label>
      </div>
    </div>

    <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label={`Move ${field.label} up`} className="size-11 shrink-0 rounded-lg text-muted-foreground transition hover:bg-secondary disabled:opacity-25">
      <ArrowUp className="mx-auto size-4" />
    </button>
    <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label={`Move ${field.label} down`} className="size-11 shrink-0 rounded-lg text-muted-foreground transition hover:bg-secondary disabled:opacity-25">
      <ArrowDown className="mx-auto size-4" />
    </button>
    <button type="button" onClick={onRemove} disabled={!field.removable} aria-label={`Remove ${field.label}`} className="size-11 shrink-0 rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-25">
      <Trash2 className="mx-auto size-4" />
    </button>
  </div>
}

export default FieldManager