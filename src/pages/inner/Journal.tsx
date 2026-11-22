import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Feather, List, Plus, Search, Star } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { JournalEntry, MoodEntry } from '../../lib/types'
import { MOODS } from '../../data/content'
import { cx, fmt, isoDate, today } from '../../lib/utils'
import { Button, Card, Chip, EmptyState, ErrorState, IconButton, Input, Loading } from '../../components/ui'

type View = 'list' | 'calendar'
type Group = 'day' | 'week' | 'month'

export default function Journal() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [view, setView] = useState<View>('list')
  const [group, setGroup] = useState<Group>('day')
  const [month, setMonth] = useState(new Date())

  const entries = useData(() => db.list<JournalEntry>('journal_entries', {
    order: [{ col: 'entry_date' }, { col: 'created_at' }],
    search: query ? { col: 'search', text: query } : undefined,
    match: favOnly ? { favorite: true } : undefined,
    filters: tag ? [{ col: 'tags', op: 'contains', value: [tag] }] : undefined,
    limit: 500,
  }), [query, favOnly, tag])
  const moods = useData(() => db.list<MoodEntry>('mood_entries', { order: [{ col: 'recorded_at' }], limit: 500 }), [])

  const allTags = useMemo(() => Array.from(new Set((entries.data ?? []).flatMap((e) => e.tags))).sort(), [entries.data])
  const moodFor = (e: JournalEntry) => moods.data?.find((m) => m.journal_entry_id === e.id)

  const groups = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    for (const e of entries.data ?? []) {
      const d = new Date(e.entry_date + 'T12:00:00')
      const key = group === 'day' ? e.entry_date : group === 'week' ? isoDate(startOfWeek(d)) : e.entry_date.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return Array.from(map.entries())
  }, [entries.data, group])
  const groupLabel = (k: string) => group === 'day' ? fmt(k, 'EEEE, MMMM d, yyyy') : group === 'week' ? `Week of ${fmt(k, 'MMMM d, yyyy')}` : fmt(k + '-01', 'MMMM yyyy')

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); setQuery(q) }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-taupe" />
          <Input className="pl-10" placeholder="Search your journal…" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setQuery('') }} />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)}><Star className="mr-1 inline size-3" />Favorites</Chip>
          <div className="inline-flex rounded-full border border-beige bg-white/60 p-0.5">
            <IconButton label="List view" className={cx('size-8', view === 'list' && 'bg-ink text-ivory hover:bg-ink hover:text-ivory')} onClick={() => setView('list')}><List className="size-4" /></IconButton>
            <IconButton label="Calendar view" className={cx('size-8', view === 'calendar' && 'bg-ink text-ivory hover:bg-ink hover:text-ivory')} onClick={() => setView('calendar')}><CalendarDays className="size-4" /></IconButton>
          </div>
          <Link to="/inner-world/journal/new"><Button variant="primary" icon={<Plus className="size-4" />}>New entry</Button></Link>
        </div>
      </div>
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          <Chip active={!tag} onClick={() => setTag(null)}>All tags</Chip>
          {allTags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t}</Chip>)}
        </div>
      )}

      {entries.error && <ErrorState message={entries.error} onRetry={entries.reload} />}
      {entries.loading && !entries.data ? <Loading /> : view === 'calendar' ? (
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl">{fmt(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <IconButton label="Previous month" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="size-4" /></IconButton>
              <IconButton label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4" /></IconButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-widest text-taupe-deep">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }).map((d) => {
              const iso = isoDate(d)
              const list = (entries.data ?? []).filter((e) => e.entry_date === iso)
              return (
                <button key={iso} onClick={() => list.length ? nav(`/inner-world/journal/${list[0].id}`) : nav(`/inner-world/journal/new?date=${iso}`)}
                  className={cx('min-h-[72px] rounded-xl p-1.5 text-left text-[12px] transition cursor-pointer sm:min-h-[92px]', d.getMonth() !== month.getMonth() && 'opacity-40', list.length ? 'bg-blush-50 hover:bg-blush-100' : 'bg-white/50 hover:bg-linen', iso === today() && 'ring-1 ring-sage')}>
                  <span className="block text-ink-soft">{d.getDate()}</span>
                  {list.slice(0, 2).map((e) => <span key={e.id} className="mt-0.5 hidden truncate font-display text-[13px] sm:block">{e.title || 'Untitled'}</span>)}
                  {list.length > 0 && <span className="mt-1 block size-1.5 rounded-full bg-blush-deep sm:hidden" />}
                </button>
              )
            })}
          </div>
        </Card>
      ) : !entries.data?.length ? (
        <EmptyState icon={<Feather className="size-7" strokeWidth={1.2} />} title={query || tag || favOnly ? 'No entries match' : 'Your first page is waiting'} body={query ? 'Try different words.' : 'Write freely, or begin with a guided prompt. Everything autosaves as you write.'}
          action={<Link to="/inner-world/journal/new"><Button variant="primary">Start writing</Button></Link>} />
      ) : (
        <>
          <div className="mb-4 flex gap-1.5">
            {(['day', 'week', 'month'] as Group[]).map((g) => <Chip key={g} active={group === g} onClick={() => setGroup(g)}>{g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</Chip>)}
          </div>
          <div className="space-y-10">
            {groups.map(([k, list]) => (
              <section key={k}>
                <p className="eyebrow mb-3">{groupLabel(k)} · {list.length} {list.length === 1 ? 'entry' : 'entries'}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {list.map((e) => {
                    const m = moodFor(e)
                    return (
                      <Link key={e.id} to={`/inner-world/journal/${e.id}`} className="group">
                        <Card className="h-full p-6 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[12px] text-taupe-deep">{fmt(e.entry_date, 'EEE, MMM d')}</p>
                            <div className="flex items-center gap-1.5">
                              {m && <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: MOODS.find((x) => x.value === m.mood)?.tone }}>{m.label}</span>}
                              {e.favorite && <Star className="size-3.5 fill-blush text-blush" />}
                            </div>
                          </div>
                          <h3 className="mt-1 text-[1.55rem] leading-tight">{e.title || 'Untitled entry'}</h3>
                          <p className="mt-2 line-clamp-3 text-[14.5px] text-ink-soft">{e.body || <em>Empty page</em>}</p>
                          {e.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{e.tags.map((t) => <span key={t} className="text-[12px] text-taupe-deep">#{t}</span>)}</div>}
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
