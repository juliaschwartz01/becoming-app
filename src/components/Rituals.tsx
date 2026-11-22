import { useState } from 'react'
import { Check, ChevronDown, Moon, Sun } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import { useProfile } from '../lib/profile'
import type { RitualCompletion } from '../lib/types'
import { EVENING_PRACTICES, MOODS, MORNING_PRACTICES } from '../data/content'
import { cx, today } from '../lib/utils'
import { Button, Card, ErrorState, Spinner, Textarea, useAction } from './ui'

export default function RitualsWidget() {
  const { prefs } = useProfile()
  const date = today()
  const done = useData(() => db.list<RitualCompletion>('ritual_completions', { match: { ritual_date: date } }), [date])
  const hour = new Date().getHours()
  const [period, setPeriod] = useState<'morning' | 'evening'>(hour >= 16 ? 'evening' : 'morning')
  const keys = period === 'morning' ? prefs?.morning_practices ?? [] : prefs?.evening_practices ?? []
  const defs = (period === 'morning' ? MORNING_PRACTICES : EVENING_PRACTICES).filter((p) => keys.includes(p.key))
  const completed = (done.data ?? []).filter((d) => d.period === period)
  const count = completed.length

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Daily rituals</p>
          <h2 className="text-[1.7rem] leading-tight">{period === 'morning' ? 'Morning practice' : 'Evening practice'}</h2>
        </div>
        <div className="inline-flex rounded-full border border-beige bg-white/60 p-1">
          <button onClick={() => setPeriod('morning')} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] cursor-pointer', period === 'morning' ? 'bg-ink text-ivory' : 'text-ink-soft')}><Sun className="size-3.5" /> Morning</button>
          <button onClick={() => setPeriod('evening')} className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] cursor-pointer', period === 'evening' ? 'bg-ink text-ivory' : 'text-ink-soft')}><Moon className="size-3.5" /> Evening</button>
        </div>
      </div>
      {done.error ? <ErrorState message={done.error} onRetry={done.reload} /> : done.loading && !done.data ? <Spinner /> : (
        <>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-linen">
            <div className="h-full rounded-full bg-sage transition-all duration-700" style={{ width: `${defs.length ? (count / defs.length) * 100 : 0}%` }} />
          </div>
          <ul className="divide-y divide-beige/60">
            {defs.map((p) => (
              <RitualItem
                key={p.key}
                period={period}
                practice={p}
                completion={completed.find((c) => c.practice_key === p.key)}
                onChange={(row, removed) => done.setData((list) => {
                  const rest = (list ?? []).filter((x) => !(x.period === period && x.practice_key === p.key))
                  return removed ? rest : [...rest, row!]
                })}
              />
            ))}
          </ul>
          {!defs.length && <p className="text-[14px] text-ink-soft">No practices chosen. Pick yours in Settings.</p>}
        </>
      )}
    </Card>
  )
}

function RitualItem({ period, practice, completion, onChange }: {
  period: 'morning' | 'evening'
  practice: { key: string; label: string; prompt: string; mood?: boolean }
  completion?: RitualCompletion
  onChange: (row: RitualCompletion | null, removed?: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(completion?.content ?? '')
  const [mood, setMood] = useState<number | null>(null)
  const { run, busy } = useAction()
  const isDone = !!completion

  const complete = () => run(async () => {
    let content = text.trim() || null
    if (practice.mood && mood) {
      const label = MOODS.find((m) => m.value === mood)?.label
      await db.insert('mood_entries', { mood, label, context: content, recorded_at: new Date().toISOString() })
      content = `${label}${content ? ` — ${content}` : ''}`
    }
    const row = await db.upsert<RitualCompletion>('ritual_completions', { ritual_date: today(), period, practice_key: practice.key, content }, 'user_id,ritual_date,period,practice_key')
    onChange(row)
    setOpen(false)
  }, `${practice.label} saved`)

  const undo = () => run(async () => {
    if (!completion) return
    await db.remove('ritual_completions', completion.id)
    onChange(null, true)
  })

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <button
          aria-label={isDone ? `Mark ${practice.label} as not done` : `Complete ${practice.label}`}
          onClick={() => (isDone ? undo() : setOpen(true))}
          className={cx('flex size-7 shrink-0 items-center justify-center rounded-full border transition cursor-pointer', isDone ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand hover:border-sage')}
        >
          {isDone && <Check className="size-3.5" />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center justify-between text-left cursor-pointer">
          <span>
            <span className={cx('block text-[15px]', isDone && 'text-ink-soft')}>{practice.label}</span>
            {isDone && completion?.content && <span className="block truncate text-[13px] text-taupe-deep">{completion.content}</span>}
          </span>
          <ChevronDown className={cx('size-4 text-taupe transition', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3 pl-10 animate-rise">
          {practice.mood && (
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setMood(m.value)} className={cx('rounded-full border px-3 py-1 text-[13px] cursor-pointer', mood === m.value ? 'border-ink' : 'border-transparent')} style={{ background: m.tone }}>{m.label}</button>
              ))}
            </div>
          )}
          <Textarea rows={3} placeholder={practice.prompt} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" loading={busy} onClick={complete} disabled={practice.mood ? !mood : false}>{isDone ? 'Update' : 'Complete'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </li>
  )
}
