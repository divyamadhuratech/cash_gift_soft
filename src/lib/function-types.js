import { translate } from '@/lib/tamil-ui'

/**
 * Canonical function types offered in the setup wizard.
 *
 * The stored value is always the English label so the same record renders
 * correctly in either UI language. `Custom` lets the host type their own
 * occasion (for example "Ear piercing") without needing a code change.
 */
export const functionTypes = [
  'Wedding',
  'Engagement',
  'Ear Piercing',
  'Naming Ceremony',
  'Baby Shower',
  'Puberty Ceremony',
  'Birthday',
  'Housewarming',
  'Temple',
  'Anniversary',
  'Memorial',
  'Custom',
]

/**
 * Translate a function type into the active UI language. Unknown values (a
 * manually typed occasion) fall back to the text the user entered.
 */
export const translateFunctionType = (type, language) => translate(type ?? '', language)

/** Option list for the type selector, with English and Tamil labels. */
export const functionTypeOptions = functionTypes.map((value) => ({
  value,
  label: value,
  tamil: translate(value, 'Tamil'),
}))

export default functionTypes
