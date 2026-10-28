import { hasTamilScript, convertTamilWord, tamilModeLabel } from '@/lib/tamil-transliteration'
import { builtinEntryKeys } from '@/components/ceremony-provider'

/**
 * One collection-form input, rendered from a Function.entryFields entry.
 * The order of that array is the order shown here, so dragging in Setup
 * reorders this form. Built-in keys write to real Entry columns; everything else
 * lands in `custom[key]`.
 */
export function EntryFieldInput({ field, values, onChange, uiLanguage, languageMode, onToggleLanguage }) {
  const builtin = builtinEntryKeys.has(field.key)
  const raw = values[field.key] ?? ''
  const value = languageMode === tamilModeLabel && !hasTamilScript(raw) ? convertTamilWord(raw).text : raw
  const id = `entry-field-${field.key}`
  const label = uiLanguage === 'Tamil' && field.tamil ? field.tamil : field.label
  const hint = uiLanguage === 'Tamil' && field.tamil ? field.label : field.tamil

  function commit(next) {
    onChange(field.key, next, builtin)
  }

  function control() {
    if (field.type === 'select') {
      return (
        <select id={id} className="form-select" value={value} onChange={(event) => commit(event.target.value)} required={field.required}>
          <option value="">—</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      )
    }
    if (field.type === 'longtext') {
      return <textarea id={id} className="form-input form-textarea" value={value} onChange={(event) => commit(event.target.value)} required={field.required} />
    }
    return (
      <input
        id={id}
        className={`form-input${languageMode === tamilModeLabel && !builtin ? ' pr-14' : ''}`}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(event) => commit(event.target.value)}
        required={field.required}
        placeholder={builtin && field.key === 'name' ? 'e.g. Priya or பிரியா' : ''}
      />
    )
  }

  const showToggle = languageMode === tamilModeLabel && !builtin && field.type === 'text'

  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label} {field.required && <span className="text-destructive">*</span>}
      </label>
      <div className="relative">
        {control()}
        {showToggle && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border bg-background px-1.5 py-1 text-[10px] font-semibold text-muted-foreground"
            onClick={() => onToggleLanguage?.(field.key)}
            aria-label={`Toggle typing language for ${field.label}`}
          >
            A|அ
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default EntryFieldInput