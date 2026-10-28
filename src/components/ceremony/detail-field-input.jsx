import { categoryOptions, localized } from '@/components/ceremony-provider'

const categoryTamil = {
  'Family celebration': 'குடும்ப விழா',
  'Religious function': 'சமய விழா',
  'Community event': 'சமூக நிகழ்ச்சி',
  Other: 'மற்றவை',
}

/**
 * Renders one function-detail input. `field.key` maps straight onto the function
 * document, so removing a field here simply stops it being collected.
 */
export function DetailFieldInput({ field, details, onChange, uiLanguage, invalid = false }) {
  const value = details[field.key] ?? ''
  const set = (next) => onChange({ ...details, [field.key]: next })
  const id = `detail-${field.key}`
  const label = uiLanguage === 'Tamil' && field.tamil ? field.tamil : field.label
  const hint = uiLanguage === 'Tamil' && field.tamil ? field.label : field.tamil

  const control = () => {
    const invalidRing = invalid ? ' !border-destructive focus:!border-destructive' : ''
    if (field.type === 'select') {
      const options = field.key === 'category' ? categoryOptions : (field.options ?? [])
      return <select id={id} aria-invalid={invalid || undefined} className={`form-select${invalidRing}`} value={value} onChange={(event) => set(event.target.value)}>
        <option value="">{localized(uiLanguage, 'Select', 'தேர்ந்தெடுக்கவும்')}</option>
        {options.map((option) => <option key={option} value={option}>{localized(uiLanguage, option, categoryTamil[option] ?? option)}</option>)}
      </select>
    }
    if (field.type === 'longtext') {
      return <textarea id={id} aria-invalid={invalid || undefined} className={`form-input form-textarea${invalidRing}`} value={value} onChange={(event) => set(event.target.value)} placeholder={localized(uiLanguage, 'Optional details', 'விருப்ப விவரங்கள்')} />
    }
    return <input id={id} aria-invalid={invalid || undefined} className={`form-input${invalidRing}`} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} value={value} onChange={(event) => set(event.target.value)} placeholder={localized(uiLanguage, `Enter ${field.label.toLowerCase()}`, `${field.label} உள்ளிடவும்`)} />
  }

  return <div>
    <label className="form-label" htmlFor={id}>{label} {field.required && <span className="text-destructive">*</span>}</label>
    {control()}
    {invalid && <p className="mt-1 text-[11px] font-semibold text-destructive">{localized(uiLanguage, 'This field is required', 'இந்தப் புலம் கட்டாயம்')}</p>}
    {!invalid && hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
}

export default DetailFieldInput