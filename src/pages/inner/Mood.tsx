import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { subDays } from 'date-fns'
import { Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { JournalEntry, MoodEntry } from '../../lib/types'
import { MOODS, MOOD_WORDS } from '../../data/content'
import { cx, fmt, isoDate } from '../../lib/utils'
import { Button, Card, Chip, EmptyState, ErrorState, Field, IconButton, Loading, Select, TagInput, Textarea, useAction, useFeedback } from '../../components/ui'

export default function Mood() {
  const [range, setRange] = useState(30)
  const since = subDays(new Date(), range).toISOString()
  const moods = useData(() => db.list<MoodEntry>('mood_entries', { filters: [{ col: 'recorded_at', op: 'gte', value: since }], order: [{ col: 'recorded_at' }] }), [range])
  const entries = useData(() => db.list<JournalEntry>('journal_entries', { order: [{ col: 'entry_date' }], limit: 30 }), [])
  const { run, busy } = useAction()
  const { confirm } = useFeedback()

  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [themes, setThemes] = useState<string[]>([])
  const [context, setContext] = useState('')
  const [entryId, setEntryId] = useState('')

  const save = () => run(async () => {
    const m = MOODS.find((x) => x.value === mood)!
    const row = await db.insert<MoodEntry>('mood_entries', { mood: m.value, label: m.label, energy, themes, context: context.trim() || null, journal_entry_id: entryId || null, recorded_at: new Date().toISOString() })
    moods.setData((l) => [row, ...(l ?? [])])
    setMood(null); setEnergy(null); setThemes([]); setContext(''); setEntryId('')
  }, 'Check-in saved')

  const remove = async (m: MoodEntry) => {
    if (!(await confirm({ title: 'Delete check-in?', body: 'This mood check-in will be permanently deleted.', confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await db.remove('mood_entries', m.id); moods.setData((l) => l?.filter((x) => x.id !== m.id)) }, 'Deleted')
  }

  // Daily averages for the chart (purely arithmetic — no interpretation).
  const series = useMemo(() => {
    const days = Array.from({ length: range }, (_, i) => isoDate(subDays(new Date(), range - 1 - i)))
    const byDay = new Map<string, number[]>()
    for (const m of moods.data ?? []) { const d = isoDate(new Date(m.recorded_at)); byDay.set(d, [...(byDay.get(d) ?? []), m.mood]) }
    return days.map((d) => { const v = byDay.get(d); return { d, v: v ? v.reduce((a, b) => a + b, 0) / v.length : null } })
  }, [moods.data, range])
  const themeCounts = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of moods.data ?? []) for (const t of m.themes ?? []) c.set(t, (c.get(t) ?? 0) + 1)
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [moods.data])
  const counts = MOODS.map((m) => ({ ...m, n: (moods.data ?? []).filter((x) => x.mood === m.value).length }))
  const total = moods.data?.length ?? 0

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
      <Card className="h-fit p-6 sm:p-7">
        <p className="eyebrow mb-1">Emotional check-in</p>
        <h2 className="mb-5 text-[1.8rem]">How are you, really?</h2>
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => (
            <button key={m.value} onClick={() => setMood(m.value)} className={cx('rounded-2xl px-1 py-4 text-[12.5px] transition cursor-pointer', mood === m.value ? 'ring-2 ring-ink' : 'hover:-translate-y-0.5')} style={{ background: m.tone }}>{m.label}</button>
          ))}
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Energy</p>
            <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <Chip key={n} active={energy === n} onClick={() => setEnergy(energy === n ? null : n)}>{['Drained', 'Low', 'Okay', 'Good', 'Full'][n - 1]}</Chip>)}</div>
          </div>
          <Field label="Words for it (recurring themes)"><TagInput value={themes} onChange={setThemes} placeholder="e.g. anxious, hopeful" suggestions={MOOD_WORDS} /></Field>
          <Field label="Context"><Textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder="What’s happening around this feeling?" /></Field>
          <Field label="Connect to a journal entry">
            <Select value={entryId} onChange={(e) => setEntryId(e.target.value)}>
              <option value="">None</option>
              {(entries.data ?? []).map((e) => <option key={e.id} value={e.id}>{fmt(e.entry_date, 'MMM d')} — {e.title || 'Untitled'}</option>)}
            </Select>
          </Field>
          <Button variant="primary" className="w-full" disabled={!mood} loading={busy} onClick={save}>Save check-in</Button>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-6 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[1.6rem]">Mood over time</h2>
            <div className="flex gap-1.5">{[7, 30, 90].map((r) => <Chip key={r} active={range === r} onClick={() => setRange(r)}>{r} days</Chip>)}</div>
          </div>
          {moods.error ? <ErrorState message={moods.error} onRetry={moods.reload} /> : moods.loading && !moods.data ? <Loading /> : <MoodChart series={series} />}
          <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-linen">
            {counts.map((c) => c.n > 0 && <div key={c.value} title={`${c.label}: ${c.n}`} style={{ width: `${(c.n / Math.max(total, 1)) * 100}%`, background: c.tone }} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
            {counts.map((c) => <span key={c.value} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c.tone }} />{c.label} {c.n}</span>)}
          </div>
          {themeCounts.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow mb-2">Themes you recorded</p>
              <div className="flex flex-wrap gap-1.5">{themeCounts.map(([t, n]) => <span key={t} className="rounded-full bg-linen px-2.5 py-0.5 text-[12.5px]">{t} · {n}</span>)}</div>
            </div>
          )}
          <p className="mt-4 text-[11.5px] text-taupe-deep">These are simple counts and averages of what you recorded — no psychological interpretation.</p>
        </Card>

        <Card className="p-6 sm:p-7">
          <h2 className="mb-4 text-[1.6rem]">History</h2>
          {!moods.data?.length ? <EmptyState title="No check-ins in this period" /> : (
            <ul className="divide-y divide-beige/60">
              {moods.data.map((m) => (
                <li key={m.id} className="group flex items-start gap-3 py-3">
                  <span className="mt-0.5 rounded-full px-2.5 py-0.5 text-[12px]" style={{ background: MOODS.find((x) => x.value === m.mood)?.tone }}>{m.label}</span>
                  <div className="min-w-0 flex-1 text-[14px]">
                    <p className="text-[12px] text-taupe-deep">{fmt(m.recorded_at, 'EEE, MMM d · h:mm a')}{m.energy ? ` · energy ${m.energy}/5` : ''}</p>
                    {m.context && <p className="text-ink-soft">{m.context}</p>}
                    {m.themes?.length > 0 && <p className="text-[12.5px] text-taupe-deep">{m.themes.join(', ')}</p>}
                    {m.journal_entry_id && <Link to={`/inner-world/journal/${m.journal_entry_id}`} className="text-[12.5px] underline decoration-sand underline-offset-2">Linked journal entry</Link>}
                  </div>
                  <IconButton label="Delete" className="size-8 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(m)}><Trash2 className="size-3.5" /></IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function MoodChart({ series }: { series: { d: string; v: number | null }[] }) {
  const W = 600, H = 180, P = 24
  const pts = series.map((s, i) => ({ x: P + (i / Math.max(series.length - 1, 1)) * (W - 2 * P), y: s.v === null ? null : H - P - ((s.v - 1) / 4) * (H - 2 * P), ...s }))
  const segs: string[] = []
  let cur = ''
  for (const p of pts) {
    if (p.y === null) { if (cur) segs.push(cur); cur = ''; continue }
    cur += cur ? ` L ${p.x} ${p.y}` : `M ${p.x} ${p.y}`
  }
  if (cur) segs.push(cur)
  if (!pts.some((p) => p.y !== null)) return <p className="py-10 text-center text-[14px] text-ink-soft">Record a few check-ins to see your trend.</p>
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Average mood per day">
      {[1, 3, 5].map((v) => { const y = H - P - ((v - 1) / 4) * (H - 2 * P); return <g key={v}><line x1={P} x2={W - P} y1={y} y2={y} stroke="#e6dac8" strokeDasharray="3 4" /><text x={0} y={y + 4} fontSize="10" fill="#a8978a">{MOODS[v - 1].label.slice(0, 3)}</text></g> })}
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="#8d9c7e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
      {pts.filter((p) => p.y !== null).map((p) => <circle key={p.d} cx={p.x} cy={p.y!} r="3.5" fill="#fbf8f3" stroke="#64725a" strokeWidth="1.5"><title>{`${fmt(p.d)}: ${p.v!.toFixed(1)}`}</title></circle>)}
    </svg>
  )
}
