/**
 * Central Tamil dictionary for editor / designer interface text.
 *
 * Every string is keyed by its English source so a missing entry falls back to
 * English instead of rendering a raw key. `translate()` is the single entry
 * point used by the designer, the entries template builder and the wizard.
 */

const tamil = {
  // Wizard steps
  'Occasion': 'விழா',
  'Details': 'விவரங்கள்',
  'Fields': 'புலங்கள்',
  'Groups': 'குழுக்கள்',
  'Language': 'மொழி',
  'Branding': 'அலங்காரம்',
  'Entries Template Design': 'பதிவுப் பட்டியல் வடிவமைப்பு',
  'Receipt Designer': 'ரசீது வடிவமைப்பு',
  'Choose the occasion': 'விழாவைத் தேர்ந்தெடுக்கவும்',
  'Add function details': 'நிகழ்ச்சி விவரங்களைச் சேர்க்கவும்',
  'Choose guest information': 'விருந்தினர் தகவலைத் தேர்ந்தெடுக்கவும்',
  'Organize your invitees': 'அழைப்பாளர்களை ஒழுங்குபடுத்தவும்',
  'Set the language': 'மொழியை அமைக்கவும்',
  'Add your visual touch': 'உங்கள் காட்சி வடிவத்தைச் சேர்க்கவும்',
  'Design the entries list': 'பதிவுப் பட்டியலை வடிவமைக்கவும்',
  'Shape your receipt': 'உங்கள் ரசீதை வடிவமைக்கவும்',

  // Stepper / navigation
  'Step': 'படி',
  'of': '/',
  'Previous': 'முந்தையது',
  'Continue': 'தொடரவும்',
  'Next': 'அடுத்து',
  'Back to setup': 'அமைப்புக்குத் திரும்பு',
  'Back': 'பின்செல்',
  'Save': 'சேமி',
  'Save design': 'வடிவத்தைச் சேமி',
  'Saved': 'சேமிக்கப்பட்டது',
  'Save changes': 'மாற்றங்களைச் சேமி',
  'Save & Start Collection': 'சேமித்து சேகரிப்பைத் தொடங்கு',
  'Cancel': 'ரத்து',
  'Close': 'மூடு',
  'Done': 'முடிந்தது',
  'Apply': 'பயன்படுத்து',
  'Reset': 'மீட்டமை',
  'Undo': 'செயல்தவிர்',
  'Redo': 'மீண்டும் செய்',
  'Duplicate': 'நகலெடு',
  'Print': 'அச்சிடு',
  'Print test': 'சோதனை அச்சிடு',
  'Print entries list': 'பதிவுப் பட்டியலை அச்சிடு',
  'Set default': 'இயல்பாக அமைக்கு',
  'Set as default': 'இயல்பாக அமைக்கு',

  // Designer chrome
  'Layers': 'அடுக்குகள்',
  'Layer': 'அடுக்கு',
  'Inspector': 'ஆய்வி',
  'Properties': 'பண்புகள்',
  'Templates': 'வார்ப்புருக்கள்',
  'Template': 'வார்ப்புரு',
  'Live canvas': 'நேரடி விளக்கப்படம்',
  'Canvas': 'விளக்கப்படம்',
  'Preview': 'முன்னோட்டம்',
  'Preview language': 'முன்னோட்ட மொழி',
  'Design name': 'வடிவத்தின் பெயர்',
  'Add text': 'உரையைச் சேர்',
  'Add heading': 'தலைப்பைச் சேர்',
  'Add divider': 'கோடு சேர்',
  'Divider': 'கோடு',
  'Spacer': 'இடைவெளி',
  'Move up': 'மேலே கொண்டு செல்',
  'Move down': 'கீழே கொண்டு செல்',
  'Hide layer': 'அடுக்கை மறை',
  'Show layer': 'அடுக்கைக் காட்டு',
  'Delete layer': 'அடுக்கை நீக்கு',
  'Drag to reorder': 'மாற்ற ஈர்பு',
  'No layers yet': 'இன்னும் அடுக்குகள் இல்லை',
  'Add a layer to start designing.': 'வடிவமைக்க ஒரு அடுக்கைச் சேர்க்கவும்.',
  'Selected layer': 'தேர்ந்தெடுத்த அடுக்கு',
  'English text': 'ஆங்கில உரை',
  'Tamil text': 'தமிழ் உரை',
  'Visible on the printed receipt': 'அச்சிக்கப்படும் ரசீதில் காட்டு',
  'This layer has no text.': 'இந்த அடுக்கில் உரை இல்லை.',
  'Insert a token': 'சொற்றொடரைச் சேர்',
  'Design saved.': 'வடிவம் சேமிக்கப்பட்டது.',
  'Changes stay on this function until you save.': 'சேமிப்பதரை இந்த நிகழ்ச்சிக்கே மாற்றங்கள் இருக்கும்.',

  // Design controls
  'Paper': 'காகிதம்',
  'Paper size': 'காகித அளவு',
  'Accent colour': 'நிறக் குறியீடு',
  'Accent color': 'நிறக் குறியீடு',
  'Text colour': 'உரை நிறம்',
  'Text color': 'உரை நிறம்',
  'Border': 'கிடிவெல்',
  'Border style': 'கிடிவெல் வகை',
  'Border colour': 'கிடிவெல் நிறம்',
  'Border color': 'கிடிவெல் நிறம்',
  'Border width': 'கிடிவெல் அகலம்',
  'Thickness': 'தடிப்பு',
  'Alignment': 'சீரமைப்பு',
  'Align left': 'இடது பக்கம்',
  'Align centre': 'நடுப்புறம்',
  'Align center': 'நடுப்புறம்',
  'Align right': 'வலது பக்கம்',
  'Justify': 'சமமாக்கு',
  'Font size': 'எழுத்துரு அளவு',
  'Line height': 'வரி உயரம்',
  'Letter spacing': 'எழுத்து இடைவெளி',
  'Spacing': 'இடைவெளி',
  'Margin': 'விளிச்சு',
  'Padding': 'உட்புற விளிச்சு',
  'Line spacing': 'வரி இடைவெளி',
  'Bold': 'தடிப்பு',
  'Italic': 'சாய்ந்து',
  'Uppercase': 'பெரிய எழுத்து',
  'Custom colour': 'தனிப்பயன் நிறம்',
  'Custom color': 'தனிப்பயன் நிறம்',
  'Pick a colour': 'நிறத்தைத் தேர்ந்தெடுக்கவும்',
  'Pick a color': 'நிறத்தைத் தேர்ந்தெடுக்கவும்',
  'HEX': 'ஹெக்ஸ்',
  'RGB': 'ஆர்ஜிபி',
  'Use the colour picker': 'நிறத் தேர்வியைப் பயன்படுத்தவும்',
  'Recent colours': 'சமீபத்திய நிறங்கள்',

  // Branding / entries template
  'Logo': 'சின்னம்',
  'Upload logo': 'சின்னம் பதிவேற்று',
  'Replace logo': 'சின்னத்தை மாற்று',
  'Remove logo': 'சின்னத்தை நீக்கு',
  'Background': 'பின்னணி',
  'Upload background': 'பின்னணி பதிவேற்று',
  'Replace background': 'பின்னணியை மாற்று',
  'Remove background': 'பின்னணியை நீக்கு',
  'Logo position': 'சின்னம் இடம்',
  'Left': 'இடது',
  'Right': 'வலது',
  'Centre': 'நடுப்புறம்',
  'Center': 'நடுப்புறம்',
  'Top': 'மேல்',
  'Bottom': 'கீழ்',

  // Entries template design
  'Table columns': 'அட்டவணை நிரல்கள்',
  'Columns': 'நிரல்கள்',
  'Row height': 'வரி உயரம்',
  'Rows': 'வரிகள்',
  'Show serial number column': 'எண் நிரலைக் காட்டு',
  'Show receipt number': 'ரசீது எண்ணைக் காட்டு',
  'Show payment reference': 'கட்டண குறிப்பைக் காட்டு',
  'Show totals row': 'மொத்த வரிசையைக் காட்டு',
  'Show summary block': 'சுருக்கம் பகுதியைக் காட்டு',
  'Plain A4 sheet': 'வெறுமையான A4 தாள்',
  'Table style': 'அட்டவணை வகை',
  'Sheet size': 'தாள் அளவு',
  'Print centred on the page': 'பக்கத்தின் நடுவில் அச்சிக்கவும்',
  'Print the heading': 'தலைப்பை அச்சிக்கவும்',
  'Entries list only': 'பதிவுப் பட்டியல் மட்டும்',
  'Receipt designs live in Step 6': 'ரசீது வடிவங்கள் படி 6 இல் உள்ளன',
  'This step designs the printed entries list handed to the host family. It never changes the receipt.': 'இந்தப் படி குடுமத்தின் தலைவருக்கு வழங்கப்படும் பதிவுப் பட்டியலை வடிவமைக்கிறது. ரசீதை இது மாற்றாது.',
  'Shape the printed receipt: layers, borders, alignment and colours. Everything here appears on the guest’s receipt.': 'அச்சிக்கப்படும் ரசீதை வடிவமைக்கவும்: அடுக்குகள், கிடிவெல்கள், சீரமைப்பு, நிறங்கள். இங்கு உள்ள அனைத்தும் விருந்தினரின் ரசீதில் தோன்றும்.',
  'Double click a line on the canvas to type directly.': 'விளக்கப்படத்தில் ஒரு வரியை இரட்டைசெய்து நேரடியாகத் தட்டச்சு செய்யவும்.',
  'Click a layer, then edit it here or on the canvas.': 'ஒரு அடுக்கைத் தேர்ந்தெடுத்து, அதை இங்கே அல்லது விளக்கப்படத்தில் திருத்தவும்.',
  'Open full screen': 'முழு திரையில் திற',
  'Sample guest': 'மாதிரி விருந்தினர்',
  'Normal': 'சாதாரணம்',
  'uploading…': 'பதிவேற்றுகிறது…',

  // Borders
  'none': 'எதுவுமில்லை',
  'solid': 'தொடர்',
  'double': 'இரட்டை',
  'dashed': 'குழிவு',
  'dotted': 'புள்ளி',
  'thick': 'தடித்த',
  'groove': 'பள்ளம்',
  'ridge': 'முகட்டு',
  'inset': 'உள்ளே',
  'outset': 'வெளியே',
  'decorative': 'அலங்காரம்',

  // Language
  'English': 'ஆங்கிலம்',
  'Tamil': 'தமிழ்',
  'Both': 'இரண்டும்',

  // Misc
  'Yes': 'ஆம்',
  'No': 'இல்லை',
  'None': 'எதுவுமில்லை',
  'Optional': 'விருப்பத்தேர்வு',
  'Required': 'கட்டாயம்',
  'Name': 'பெயர்',
  'Notes': 'குறிப்புகள்',
  'Reference': 'குறிப்பு எண்',
  'Amount': 'தொகை',
  'Time': 'நேரம்',
  'Date': 'தேதி',
  'Payment mode': 'பணம் செலுத்தும் முறை',
  'Payment reference': 'கட்டண குறிப்பு',
  'Totals': 'மொத்தம்',
  'Guest name': 'விருந்தினர் பெயர்',
  'Function name': 'நிகழ்ச்சி பெயர்',
  'Organizer': 'ஒருங்கிணைப்பாளர்',
  'Custom text': 'தனிப்பயன் உரை',
  'Untitled design': 'பெயரில்லா வடிவம்',
}

/** Translate an English UI string into Tamil. Falls back to English. */
export function translate(text, language) {
  if (language !== 'Tamil') return text
  return tamil[text] ?? text
}

/** True when a dictionary entry exists for the given English string. */
export const hasTamil = (text) => Object.prototype.hasOwnProperty.call(tamil, text)

/**
 * Translates `Selected layer · Guest Name` style labels that interpolate a
 * dynamic name after a separator.
 */
export function translateWith(name, language, prefix = 'Selected layer') {
  const base = translate(prefix, language)
  return language === 'Tamil' ? `${base} · ${name}` : `${prefix} · ${name}`
}

export const tamilKeys = Object.keys(tamil)
export { tamil }
export default tamil
