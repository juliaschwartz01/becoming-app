import { isArtifact } from './config'
import { artifactSave } from './artifact'
import { format, parseISO, isValid } from 'date-fns'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const today = () => isoDate()

export function dayOfYear(d: Date = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

export function fmt(d: string | Date | null | undefined, pattern = 'MMM d, yyyy') {
  if (!d) return ''
  const date = typeof d === 'string' ? (d.length === 10 ? parseISO(d + 'T12:00:00') : parseISO(d)) : d
  return isValid(date) ? format(date, pattern) : ''
}

export function greeting(d: Date = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export const pick = <T,>(arr: readonly T[], seed: number) => arr[((seed % arr.length) + arr.length) % arr.length]

export function splitLines(s: string | null | undefined): string[] {
  return (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
}

export function safeFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'file'
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return ext ? `${base}.${ext}` : base
}

export function bytes(n: number | null | undefined) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Save a file to the viewer's device. Inside claude.ai this asks the viewer to confirm. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isArtifact) return artifactSave(filename, blob)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadJSON(data: unknown, filename: string): Promise<void> {
  return downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename)
}

/**
 * Split extracted text into searchable passages, keeping page numbers.
 * Passages break on paragraph boundaries where possible (~900 characters each).
 */
export function chunkText(pages: { page: number | null; text: string }[], target = 900): { page: number | null; content: string }[] {
  const out: { page: number | null; content: string }[] = []
  for (const { page, text } of pages) {
    const paras = text.replace(/\r/g, '').split(/\n\s*\n|(?<=[.!?])\s{2,}/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
    let buf = ''
    const flush = () => { if (buf.trim()) out.push({ page, content: buf.trim() }); buf = '' }
    for (const p of paras) {
      if (p.length > target * 1.6) {
        flush()
        const sentences = p.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [p]
        for (const s of sentences) {
          if ((buf + s).length > target && buf) flush()
          buf += s
        }
        flush()
        continue
      }
      if ((buf + '\n\n' + p).length > target && buf) flush()
      buf = buf ? `${buf}\n\n${p}` : p
    }
    flush()
  }
  return out
}

/** Render "<<word>>" search markers from search results as highlighted text segments. */
export function highlightParts(snippet: string): { text: string; hit: boolean }[] {
  return snippet.split(/(<<.*?>>)/g).filter(Boolean).map((s) => s.startsWith('<<') ? { text: s.slice(2, -2), hit: true } : { text: s, hit: false })
}
