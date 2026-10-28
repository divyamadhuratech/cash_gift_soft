import { useEffect, useRef, useState } from 'react'
import { ArrowDown, CornerDownLeft, Loader2 } from 'lucide-react'
import { rememberWordChoice, transliterateTamil } from '@/lib/tamil-transliteration'

const statusLabels = {
  idle: 'Ready — type Thanglish above',
  google: 'Google Input Tools (online)',
  cache: 'Google Input Tools (cached)',
  learned: 'Your saved spelling applied',
  offline: 'Offline fallback (rough quality)',
}

export function ThanglishComposer({ id, sourceLabel = 'Thanglish (English)', targetLabel = 'Tamil', sourcePlaceholder, targetPlaceholder, commitLabel = 'Add', onCommit, inputRef }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [word, setWord] = useState('')
  const [chips, setChips] = useState([])
  const [status, setStatus] = useState('idle')
  const [converting, setConverting] = useState(false)
  const timer = useRef(null)
  const controller = useRef(null)
  const token = useRef(0)

  useEffect(() => () => { window.clearTimeout(timer.current); controller.current?.abort() }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    controller.current?.abort()
    const text = source.trim()
    if (!text) {
      token.current += 1
      setTarget('')
      setWord('')
      setChips([])
      setStatus('idle')
      setConverting(false)
      return
    }
    setConverting(true)
    timer.current = window.setTimeout(async () => {
      const current = ++token.current
      const abort = new AbortController()
      controller.current = abort
      try {
        const result = await transliterateTamil(text, { signal: abort.signal })
        if (token.current !== current) return
        setTarget(result.text)
        setWord(result.lastWord?.english ?? '')
        setChips(result.lastWord?.options ?? [])
        setStatus(result.source)
      } catch (error) {
        if (error?.name !== 'AbortError' && token.current === current) setStatus('offline')
      } finally {
        if (token.current === current) setConverting(false)
      }
    }, 300)
  }, [source])

  function applyChip(option) {
    rememberWordChoice(word, option)
    const parts = target.split(/(\s+)/)
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (parts[index].trim()) { parts[index] = option; break }
    }
    setTarget(parts.join(''))
    setChips([])
  }

  function commit() {
    const tamil = target.trim()
    if (!tamil) return
    onCommit?.(tamil, source.trim())
    token.current += 1
    controller.current?.abort()
    setSource('')
    setTarget('')
    setWord('')
    setChips([])
    setStatus('idle')
    setConverting(false)
    window.setTimeout(() => inputRef?.current?.focus(), 0)
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    commit()
  }

  return <div className="rounded-2xl border border-input bg-card/60 p-3 sm:p-4">
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground" htmlFor={`${id}-source`}>{sourceLabel}</label>
      {converting && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Converting" />}
    </div>
    <input ref={inputRef} id={`${id}-source`} className="form-input" autoComplete="off" spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} onKeyDown={handleKeyDown} placeholder={sourcePlaceholder} />
    <div className="flex justify-center py-1.5 text-muted-foreground/70"><ArrowDown className="size-4" /></div>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">{targetLabel}</span>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[9px]">Enter</kbd> to {commitLabel.toLowerCase()}</span>
    </div>
    <output className={`tamil-font flex min-h-[54px] w-full items-center rounded-[13px] border border-dashed px-4 py-3 text-lg leading-relaxed ${target ? 'border-primary/35 bg-[#fdf9ef] text-[#3d3425] dark:bg-secondary/50 dark:text-foreground' : 'border-border text-muted-foreground/70'}`} htmlFor={`${id}-source`}>{target || targetPlaceholder}</output>
    {(chips.length > 0 || status !== 'idle') && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="order-2 text-[11px] text-muted-foreground sm:order-1">{statusLabels[status] ?? status}</span>
      {chips.length > 0 && <div className="order-1 flex flex-wrap gap-1.5 sm:order-2">{chips.map((option) => <button key={option} type="button" className="tamil-font rounded-full border border-primary/30 px-2 py-1 text-sm text-primary transition-colors hover:bg-primary/8" onClick={() => applyChip(option)}>{option}</button>)}</div>}
    </div>}
    <button type="button" className="secondary-action mt-3 w-full py-2" disabled={!target.trim()} onClick={commit}><CornerDownLeft className="size-4" />{commitLabel}</button>
  </div>
}