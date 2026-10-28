const googleEndpoint = "https://inputtools.google.com/request"
const googleItc = "ta-t-i0-und"
const suggestionCount = 5

const learnedKey = "muhurtham-tamil-corrections"
const cacheKey = "muhurtham-thanglish-suggestions"
const maxCacheEntries = 400

const memoryCache = new Map()

const tamilScript = /[\u0B80-\u0BFF]/

export const tamilModeLabel = "தமிழ்"

const commonTamilWords = {
  pooja: "பூஜா", revadhi: "ரெவதி", ramesh: "ராமேஷ்", tamizh: "தமிழ்", lakshmi: "லக்ஷ்மி", selvam: "செல்வம்", kavitha: "கவிதா", ganesh: "கணேஷ்", madurai: "மதுரை", nila: "நிலா", muthu: "முத்து", priya: "பிரியா", kumar: "குமார்", arun: "அருண்", anitha: "அனிதா", deepa: "தீபா", divya: "திவ்யா", hari: "ஹரி", janaki: "ஜானகி", karthik: "கார்த்திக்", meena: "மீனா", murugan: "முருகன்", ravi: "ரவி", saravanan: "சரவணன்", senthil: "செந்தில்", shankar: "षங்கர்", suresh: "சுரேஷ்", vijay: "விஜய்", chennai: "சென்னை", coimbatore: "கோயம்புத்தூர்", salem: "சேலம்", trichy: "திருச்சி", thanjavur: "தஞ்சாவூர்", tirunelveli: "திருநெல்வேலி", appa: "அப்பா", amma: "அம்மா", brother: "சகோதரர்", sister: "சகோதரி", uncle: "மாமா", aunty: "அத்தை", friend: "நண்பர்", son: "மகன்", daughter: "மகள்",
  vanakkam: "வணக்கம்", enna: "என்ன", unga: "உங்க", peru: "பேரு", peyar: "பெயர்", nandri: "நன்றி", vazhga: "வாழ்க", epdi: "எப்படி", thambi: "தம்பி",
}

const consonantPairs = { th: "த", ch: "ச", zh: "ழ", sh: "ஷ" }
const consonants = { k: "க", g: "க", c: "ச", s: "ச", t: "த", d: "ட", n: "ன", p: "ப", b: "ப", m: "ம", y: "ய", r: "ர", l: "ல", v: "வ", w: "வ", j: "ஜ", h: "ஹ" }
const vowelPairs = { aa: "ா", ii: "ீ", uu: "ூ", ee: "ே", oo: "ோ", ai: "ை", au: "ௌ" }
const vowelSigns = { a: "", i: "ி", u: "ு", e: "ெ", o: "ொ" }
const standaloneVowelPairs = { aa: "ஆ", ii: "ஈ", uu: "ஊ", ee: "ஏ", oo: "ஓ", ai: "ஐ", au: "ஔ" }
const standaloneVowels = { a: "அ", i: "இ", u: "உ", e: "எ", o: "ஒ" }

function offlineWord(raw) {
  const word = raw.toLowerCase().replace(/[.,!?;:]+$/g, "")
  if (commonTamilWords[word]) return commonTamilWords[word]
  let out = ""
  let index = 0
  while (index < word.length) {
    const two = word.slice(index, index + 2)
    const one = word[index]
    let consonant = null
    if (consonantPairs[two]) { consonant = consonantPairs[two]; index += 2 }
    else if (consonants[one]) { consonant = one === "n" && index === 0 ? "ந" : consonants[one]; index += 1 }
    else if (standaloneVowelPairs[two]) { out += standaloneVowelPairs[two]; index += 2; continue }
    else if (standaloneVowels[one]) { out += standaloneVowels[one]; index += 1; continue }
    else { index += 1; continue }

    const pairVowel = vowelPairs[word.slice(index, index + 2)]
    const singleVowel = vowelSigns[word[index]]
    if (pairVowel !== undefined) { out += consonant + pairVowel; index += 2 }
    else if (singleVowel !== undefined) { out += consonant + singleVowel; index += 1 }
    else out += `${consonant}்`
  }
  return out || raw
}

function readStore(storageKey) {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") } catch { return {} }
}

function writeStore(storageKey, value) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { return }
}

function learnedWords() { return readStore(learnedKey) }

function wordKey(value) { return value.trim().toLowerCase().replace(/[.,!?;:]+$/g, "") }

function cachedOptions(word) {
  const key = word.trim().toLowerCase()
  return memoryCache.get(key) ?? readStore(cacheKey)[key] ?? null
}

function cacheOptions(word, options) {
  const key = word.trim().toLowerCase()
  memoryCache.set(key, options)
  const store = readStore(cacheKey)
  store[key] = options
  const keys = Object.keys(store)
  if (keys.length > maxCacheEntries) for (const stale of keys.slice(0, keys.length - maxCacheEntries)) delete store[stale]
  writeStore(cacheKey, store)
}

export function rememberWordChoice(word, tamil) {
  const key = wordKey(word)
  if (!key || !tamil?.trim() || tamilScript.test(key)) return false
  const store = learnedWords()
  if (store[key] === tamil.trim()) return false
  writeStore(learnedKey, { ...store, [key]: tamil.trim() })
  return true
}

export function learnTamilCorrection(english, tamil) {
  const englishWords = (english ?? "").split(/\s+/).filter(Boolean)
  const tamilWords = (tamil ?? "").split(/\s+/).filter(Boolean)
  if (!englishWords.length || englishWords.length !== tamilWords.length) return 0
  return englishWords.reduce((stored, word, index) => stored + (rememberWordChoice(word, tamilWords[index]) ? 1 : 0), 0)
}

function requestUrl(word) {
  const params = new URLSearchParams({ text: word, itc: googleItc, num: String(suggestionCount), cp: "0", cs: "1", ie: "utf-8", oe: "utf-8" })
  return `${googleEndpoint}?${params.toString()}`
}

async function fetchOptions(word, signal) {
  const response = await fetch(requestUrl(word), { mode: "cors", signal })
  if (!response.ok) throw new Error("Google Input Tools unavailable")
  const payload = await response.json()
  if (payload?.[0] !== "SUCCESS") return []
  return (payload?.[1]?.[0]?.[1] ?? []).filter((value) => typeof value === "string" && value.trim())
}

export async function googleTamilSuggestions(word, options = {}) {
  const raw = (word ?? "").trim()
  if (!raw || tamilScript.test(raw)) return { text: word, options: [], source: "english" }

  const remembered = learnedWords()[wordKey(raw)] ?? null
  let optionsList = cachedOptions(raw)
  let source = "cache"

  if (!optionsList) {
    try {
      optionsList = await fetchOptions(raw, options.signal)
    } catch (error) {
      if (error?.name === "AbortError") throw error
      optionsList = null
    }
    if (optionsList?.length) {
      cacheOptions(raw, optionsList)
      source = "google"
    }
  }

  if (!optionsList?.length) {
    const fallback = remembered ?? offlineWord(raw)
    return { text: fallback, options: remembered ? [remembered] : [], source: "offline" }
  }

  if (remembered) {
    return { text: remembered, options: optionsList.filter((value) => value !== remembered).slice(0, suggestionCount - 1), source: "learned" }
  }

  return { text: optionsList[0], options: optionsList.slice(1), source }
}

const sourceRank = { learned: 4, google: 3, cache: 2, offline: 1 }

function strongestSource(results) {
  return results.reduce((best, result) => (sourceRank[result.source] > sourceRank[best] ? result.source : best), "offline")
}

export async function transliterateTamil(value, options = {}) {
  const parts = (value ?? "").split(/(\s+)/)
  const indexes = parts.map((part, index) => ({ part, index })).filter((item) => item.part.trim())
  if (!indexes.length) return { text: value ?? "", lastWord: null }

  const results = await Promise.all(indexes.map((item) => googleTamilSuggestions(item.part, options)))
  const out = [...parts]
  indexes.forEach((item, position) => { out[item.index] = results[position].text })

  const lastIndex = indexes.length - 1
  return {
    text: out.join(""),
    source: strongestSource(results),
    lastWord: { english: indexes[lastIndex].part, tamil: results[lastIndex].text, options: results[lastIndex].options },
  }
}

export async function inputValueForMode(value, mode) {
  if (mode !== tamilModeLabel || hasTamilScript(value)) return value
  const result = await transliterateTamil(value)
  return result.text
}

export function convertTamilWord(value) {
  if (!value || hasTamilScript(value)) return { text: value, layer: "english" }
  const key = wordKey(value)
  const learned = learnedWords()[key]
  if (learned) return { text: learned, layer: "learned" }
  if (commonTamilWords[key]) return { text: commonTamilWords[key], layer: "dictionary" }
  const converted = offlineWord(value)
  return { text: converted || value, layer: converted === value ? "english" : "phonetic" }
}

export function conversionFlow(value) { return convertTamilWord(value).layer }

export function hasTamilScript(value) { return tamilScript.test(value ?? "") }

export const tamilValidationExamples = ["vanakkam", "enna", "unga", "peru", "nandri", "vazhga", "madurai", "pooja", "selvam", "muthu"]

export { commonTamilWords }