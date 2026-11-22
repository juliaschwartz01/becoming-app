import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Achievement, Goal, JournalEntry, Memory, Milestone, Reflection } from '../../lib/types'
import { localDate } from '../../lib/report'
import { cx, fmt } from '../../lib/utils'
import { Chip, EmptyState, ErrorState, Loading } from '../../components/ui'

interface Item { id: string; date: string; kind: 'achievement' | 'milestone' | 'journal' | 'memory' | 'goal' | 'breakthrough' | 'reflection'; title: string; body?: string | null; to?: string }
const KINDS: { key: Item['kind']; label: string; dot: string }[] = [
  { key: 'breakthrough', label: 'Breakthroughs', dot: '#b48678' },
  { key: 'achievement', label: 'Achievements', dot: '#d6b1a6' },
  { key: 'goal', label: 'Completed goals', dot: '#64725a' },
  { key: 'milestone', label: 'Milestones', dot: '#8d9c7e' },
  { key: 'journal', label: 'Journal reflections', dot: '#a8978a' },
  { key: 'reflection', label: 'Self-discoveries', dot: '#c9bcb0' },
  { key: 'memory', label: 'Important memories', dot: '#85766a' },
]

export default function Timeline() {
  const [hidden, setHidden] = useState<string[]>([])
  const data = useData(async () => {
    const [ach, ms, journal, mem, goals, refl] = await Promise.all([
      db.list<Achievement>('achievements', {}),
      db.list<Milestone>('milestones', { match: { done: true } }),
      db.list<JournalEntry>('journal_entries', { match: { favorite: true } }),
      db.list<Memory>('memories', { match: { status: 'verified', category: 'milestone' } }),
      db.list<Goal>('goals', { match: { status: 'completed' } }),
      db.list<Reflection>('reflections', { match: { kind: 'realization' } }),
    ])
    const items: Item[] = [
      ...ach.map((a) => ({ id: a.id, date: a.occurred_on, kind: (a.is_breakthrough ? 'breakthrough' : 'achievement') as Item['kind'], title: a.title, body: a.description, to: '/becoming/evidence' })),
      ...ms.map((m) => ({ id: m.id, date: localDate(m.done_at) ?? m.due_date ?? localDate(m.created_at)!, kind: 'milestone' as const, title: m.title, body: m.notes, to: m.chapter_id ? `/becoming/chapters/${m.chapter_id}` : undefined })),
      ...journal.map((j) => ({ id: j.id, date: j.entry_date, kind: 'journal' as const, title: j.title || 'Journal entry', body: j.body.slice(0, 220), to: `/inner-world/journal/${j.id}` })),
      ...mem.map((m) => ({ id: m.id, date: localDate(m.created_at)!, kind: 'memory' as const, title: m.content })),
      ...goals.map((g) => ({ id: g.id, date: localDate(g.completed_at) ?? localDate(g.updated_at)!, kind: 'goal' as const, title: g.title, body: g.description, to: `/coach/goals/${g.id}` })),
      ...refl.map((r) => ({ id: r.id, date: localDate(r.created_at)!, kind: 'reflection' as const, title: r.title, body: r.body, to: '/inner-world/reflections' })),
    ]
    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [])

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of (data.data ?? []).filter((x) => !hidden.includes(x.kind))) {
      const k = i.date.slice(0, 7)
      m.set(k, [...(m.get(k) ?? []), i])
    }
    return Array.from(m.entries())
  }, [data.data, hidden])

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Chip key={k.key} active={!hidden.includes(k.key)} onClick={() => setHidden((h) => (h.includes(k.key) ? h.filter((x) => x !== k.key) : [...h, k.key]))}>
            <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: k.dot }} />{k.label}
          </Chip>
        ))}
      </div>
      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}
      {data.loading && !data.data ? <Loading /> : !groups.length ? (
        <EmptyState title="Your story will gather here" body="Achievements, completed goals and milestones, favorite journal entries, realizations and milestone memories all appear on your timeline." />
      ) : (
        <div className="relative pl-8 sm:pl-0">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-sand sm:left-1/2" />
          {groups.map(([month, items]) => (
            <section key={month} className="mb-12">
              <div className="relative mb-6 sm:text-center">
                <span className="relative z-10 inline-block rounded-full bg-ivory px-4 py-1 font-display text-2xl">{fmt(`${month}-01`, 'MMMM yyyy')}</span>
              </div>
              <ol className="space-y-6">
                {items.map((i, n) => {
                  const k = KINDS.find((x) => x.key === i.kind)!
                  const card = (
                    <div className="rounded-3xl border border-beige/60 bg-white/70 p-5 shadow-soft transition hover:shadow-lift">
                      <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: k.dot }}>{k.label.replace(/s$/, '')} · {fmt(i.date, 'MMM d')}</p>
                      <p className="mt-1 font-display text-[1.35rem] leading-snug">{i.title}</p>
                      {i.body && <p className="mt-1 line-clamp-3 text-[13.5px] text-ink-soft">{i.body}</p>}
                    </div>
                  )
                  return (
                    <li key={`${i.kind}-${i.id}`} className={cx('relative sm:w-1/2', n % 2 ? 'sm:ml-auto sm:pl-10' : 'sm:pr-10')}>
                      <span className={cx('absolute top-6 size-3 rounded-full ring-4 ring-ivory', '-left-[25px]', n % 2 ? 'sm:-left-1.5' : 'sm:left-auto sm:-right-1.5')} style={{ background: k.dot }} />
                      {i.to ? <Link to={i.to}>{card}</Link> : card}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
