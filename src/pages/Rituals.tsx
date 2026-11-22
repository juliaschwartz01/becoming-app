import { subDays } from 'date-fns'
import { Moon, Sun } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import type { RitualCompletion } from '../lib/types'
import { EVENING_PRACTICES, MORNING_PRACTICES } from '../data/content'
import { Card, EmptyState, ErrorState, Loading, PageHeader } from '../components/ui'
import RitualsWidget from '../components/Rituals'
import { cx, fmt, isoDate } from '../lib/utils'

const label = (period: string, key: string) =>
  (period === 'morning' ? MORNING_PRACTICES : EVENING_PRACTICES).find((p) => p.key === key)?.label ?? key

export default function Rituals() {
  const since = isoDate(subDays(new Date(), 90))
  const rows = useData(() => db.list<RitualCompletion>('ritual_completions', { filters: [{ col: 'ritual_date', op: 'gte', value: since }], order: [{ col: 'ritual_date' }, { col: 'created_at' }] }), [since])

  const byDate = new Map<string, RitualCompletion[]>()
  for (const r of rows.data ?? []) byDate.set(r.ritual_date, [...(byDate.get(r.ritual_date) ?? []), r])
  const days = Array.from({ length: 35 }, (_, i) => isoDate(subDays(new Date(), 34 - i)))

  return (
    <>
      <PageHeader eyebrow="Home" title="Rituals" intro="Your morning and evening practices, and the quiet record of showing up for yourself." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <RitualsWidget />
        <Card className="p-6 sm:p-7">
          <p className="eyebrow mb-1">Last five weeks</p>
          <h2 className="mb-5 text-[1.7rem]">Consistency</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const n = byDate.get(d)?.length ?? 0
              return <div key={d} title={`${fmt(d)} · ${n} practice${n === 1 ? '' : 's'}`} className="aspect-square rounded-lg" style={{ background: n === 0 ? '#efe6d8' : n < 3 ? '#c9d3bd' : n < 6 ? '#a3b293' : '#64725a' }} />
            })}
          </div>
          <p className="mt-3 text-[12px] text-taupe-deep">Each square is one day; deeper green means more practices completed.</p>
        </Card>
      </div>

      <h2 className="mt-12 mb-4 text-[1.8rem]">History</h2>
      {rows.loading && !rows.data ? <Loading /> : rows.error ? <ErrorState message={rows.error} onRetry={rows.reload} /> : byDate.size === 0 ? (
        <EmptyState title="No completed practices yet" body="When you complete a morning or evening practice it will be saved here." />
      ) : (
        <div className="space-y-4">
          {Array.from(byDate.entries()).map(([date, list]) => (
            <Card key={date} className="p-5">
              <p className="font-display text-xl">{fmt(date, 'EEEE, MMMM d')}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {list.map((r) => (
                  <li key={r.id} className="flex gap-2.5 rounded-2xl bg-linen/50 px-3 py-2.5 text-[14px]">
                    {r.period === 'morning' ? <Sun className="mt-0.5 size-4 shrink-0 text-blush-deep" /> : <Moon className="mt-0.5 size-4 shrink-0 text-sage-deep" />}
                    <span><span className={cx('font-medium')}>{label(r.period, r.practice_key)}</span>{r.content && <span className="block text-ink-soft whitespace-pre-wrap">{r.content}</span>}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
