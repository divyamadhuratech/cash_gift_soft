import { todayISO } from '@/lib/ceremony-format'
import { functionTypes } from '@/lib/function-types'

export const uiLanguageStorageKey = 'muhurtham-ui-language'
export const activeFunctionStorageKey = 'muhurtham-active-function'

export const receiptElements = ['Header', 'Function Name', 'Guest Name', 'Amount', 'Payment Mode', 'Message', 'Watermark', 'Footer']
export const setupFields = ['Name', 'City', 'Relation', 'Gift Type']
export const inviteeGroups = ['Groom side', 'Bride side', 'Friends', 'Office']
export const occasionTypes = functionTypes
export const designThemes = ['Classic', 'Modern', 'Traditional']
export const receiptThemeStyles = { Classic: 'receipt-classic', Modern: 'receipt-modern', Traditional: 'receipt-traditional' }
export const entriesReportTemplates = ['Clean table', 'Compact report', 'Totals first', 'Classic ledger', 'Modern grid', 'Traditional gold', 'Minimal monochrome', 'Celebration floral']

/**
 * Six real steps. The old "Occasion" step rendered nothing, and the receipt
 * designer used to live on a separate route, so it is now the last step.
 */

export const setupStepNames = ['Details', 'Fields', 'Groups', 'Language', 'Entries Template Design', 'Receipt Designer']
export const setupStepDescriptions = [
  'Add function details',
  'Choose guest information',
  'Organize your invitees',
  'Set the language',
  'Design the printed entries list',
  'Shape your receipt',
]

export const setupStepTamilNames = ['விவரங்கள்', 'புலங்கள்', 'குழுக்கள்', 'மொழி', 'பதிவுப் பட்டியல் வடிவமைப்பு', 'ரசீது வடிவமைப்பு']
export const setupStepTamilDescriptions = [
  'நிகழ்ச்சி விவரங்களைச் சேர்க்கவும்',
  'விருந்தினர் தகவலைத் தேர்ந்தெடுக்கவும்',
  'அழைப்பாளர்களை ஒழுங்குபடுத்தவும்',
  'ரசீது மொழியை அமைக்கவும்',
  'அச்சிக்கப்படும் பதிவுப் பட்டியலை வடிவமைக்கவும்',
  'உங்கள் ரசீதை வடிவமைக்கவும்',
]

export const setupStepCount = setupStepNames.length
export const defaultDesignerElements = [...receiptElements]
export const defaultFunctionDetails = { name: '', venue: '', organizer: '', type: 'Wedding', category: 'Family celebration', date: todayISO(), targetCollection: 0 }
export const setupDefaults = { ...defaultFunctionDetails, fields: [...setupFields], groups: [...inviteeGroups], language: 'Both' }
export const categoryOptions = ['Family celebration', 'Religious function', 'Community event', 'Other']
export const languageOptions = ['English', 'Tamil', 'Both']
export const relationOptions = ['Family', 'Friend', 'Colleague', 'Guest']
export const giftTypeOptions = ['Cash gift', 'Envelope', 'Jewellery', 'Other']

/** Border styles offered by the receipt designer. */
export const borderStyles = ['none', 'solid', 'double', 'dashed', 'dotted', 'thick', 'groove', 'ridge', 'inset', 'outset', 'decorative']

/**
 * Columns available on the printed entries list. `key` matches the entry
 * field it reads, so custom setup fields can be switched on as well.
 */

export const entriesColumnCatalog = [
  { key: 'serial', label: 'S.No', tamil: 'எண்', fixed: true },
  { key: 'name', label: 'Guest', tamil: 'விருந்தினர்', fixed: true },
  { key: 'city', label: 'City', tamil: 'நகரம்' },
  { key: 'relation', label: 'Relation', tamil: 'உறவு' },
  { key: 'giftType', label: 'Gift', tamil: 'பரிசு' },
  { key: 'mode', label: 'Payment', tamil: 'கட்டணம்', fixed: true },
  { key: 'paymentReference', label: 'Reference', tamil: 'குறிப்பு' },
  { key: 'amount', label: 'Amount', tamil: 'தொகை', fixed: true },
  { key: 'receipt', label: 'Receipt No.', tamil: 'ரசீது எண்' },
  { key: 'time', label: 'Time', tamil: 'நேரம்' },
]

export const defaultEntriesColumns = ['serial', 'name', 'relation', 'mode', 'amount', 'receipt']
export const entriesRowHeights = ['Compact', 'Standard', 'Roomy']
export const entriesSheets = ['Plain A4', 'A4 landscape', 'A5 list']
export const entriesTableStyles = ['Clean table', 'Compact report', 'Totals first', 'Classic ledger', 'Modern grid', 'Traditional gold', 'Minimal monochrome', 'Celebration floral']

/**
 * The two ordered input lists a user can reshape in Setup.
 * `key` doubles as the storage key — on Entry it is `custom[key]` for custom fields,
 * or the matching column for built-ins (name / city / relation / giftType).
 */
export const detailFieldCatalog = [
  { key: 'name', label: 'Function name', tamil: 'நிகழ்ச்சி பெயர்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'venue', label: 'Venue', tamil: 'இடம்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'organizer', label: 'Organizer', tamil: 'ஒருங்கிணைப்பாளர்', type: 'text', required: false, removable: true, builtin: true },
  { key: 'type', label: 'Function type', tamil: 'நிகழ்ச்சி வகை', type: 'select', options: functionTypes, required: false, removable: false, builtin: true, allowCustom: true },
  { key: 'category', label: 'Category', tamil: 'பிரிவு', type: 'select', options: categoryOptions, required: false, removable: true, builtin: true },
  { key: 'date', label: 'Date', tamil: 'தேதி', type: 'date', required: false, removable: true, builtin: true },
  { key: 'targetCollection', label: 'Collection goal', tamil: 'சேகரிப்பு இலக்கு', type: 'number', required: false, removable: true, builtin: true },
]

export const entryFieldCatalog = [
  { key: 'name', label: 'Guest name', tamil: 'விருந்தினர் பெயர்', type: 'text', required: true, removable: false, builtin: true },
  { key: 'city', label: 'City', tamil: 'நகரம்', type: 'text', required: false, removable: true, builtin: true },
  { key: 'relation', label: 'Relation', tamil: 'உறவு', type: 'select', options: relationOptions, required: false, removable: true, builtin: true },
  { key: 'giftType', label: 'Gift type', tamil: 'பரிசு வகை', type: 'select', options: giftTypeOptions, required: false, removable: true, builtin: true },
]

/** Columns that already exist on the Entry model and are not stored in `custom`. */
export const builtinEntryKeys = new Set(['name', 'city', 'relation', 'giftType'])

export const defaultDetailFields = detailFieldCatalog.map((field, order) => ({ ...field, order }))
export const defaultEntryFields = entryFieldCatalog.map((field, order) => ({ ...field, order }))
export const modeOptions = ['Cash', 'UPI', 'Card', 'Other']
export const defaultCollectionMode = 'Cash'
export const collectionFormTitle = 'Record a gift'
export const collectionFormDescription = 'A warm welcome begins with a thoughtful record.'
export const collectionPlaceholder = 'e.g. Priya or பிரியா'
export const defaultCollectionMessage = 'With gratitude for your blessings'
export const collectionButtonLabel = 'Save & Print Receipt · சேமித்து அச்சிடு'
export const syncNotice = 'Everything you record is saved to your account.'

/** Today, formatted for the greeting line. */

export const todayDate = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
export const logoWord = 'muhurtham'
export const appTagline = 'Every gift, remembered.'
export const loginPageTitle = 'Welcome back'
export const loginPageSubtitle = 'Your collection desk is ready.'
export const loginHint = 'Sign in with the account you registered.'
export const receiptSizeLabel = 'A6 receipt preview'
export const receiptPreviewLabel = 'Live receipt preview'
export const printButtonLabel = 'Print'
export const printAgainLabel = 'Print Again'
export const backToCollectionLabel = 'Back to Collection'
export const successEntryCopy = 'Entry saved. Your receipt is ready to print.'
export const saveDesignLabel = 'Save Design'
export const printTestLabel = 'Print Test'
export const setDefaultLabel = 'Set as Default'
export const exportLabel = 'Export'
export const dateFilterOptions = ['All dates', 'Today', 'Last 7 days', 'This month']
export const minimumAmountLabel = 'Minimum amount'
export const noEntriesHint = 'Try adjusting your search or payment filter.'
export const tableEmptyMessage = 'No entries match. Clear the filters to see all gifts.'

export const modeClass = { Cash: 'payment-cash', UPI: 'payment-upi', Card: 'payment-card', Other: 'payment-other' }
