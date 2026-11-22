import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Printer, Save } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import { useProfile } from '../../lib/profile'
import type { Achievement, Goal, JournalEntry, MonthlyReview, MoodEntry, PracticeSession, Reflection, RitualCompletion } from '../../lib/types'
import { buildReport } from '../../lib/report'
import { EVENING_PRACTICES, EVIDENCE_KINDS, MORNING_PRACTICES, MOODS, methodByKey } from '../../data/content'
import { aiStatus } from '../../ai'
import { downloadJSON, fmt } from '../../lib/utils'
import { Button, Card, ErrorState, Field, IconButton, Loading, Textarea, useAction } from '../../components/ui'

const ritualLabel = (k: string) => { const [p, key] = k.split(':'); return `${p === 'morning' ? 'Morning' : 'Evening'} · ${(p === 'morning' ? MORNING_PRACTICES : EVENING_PRACTICES).find((x) => x.key === key)?.label ?? key}` }

export default function Report() {
  const [cursor, setCursor] = useState(new Date())
  const month = fmt(cursor, 'yyyy-MM')
  const start = `${month}-01`
  const end = fmt(addMonths(cursor, 1), 'yyyy-MM') + '-01'
  const { profile } = useProfile()
  const data = useData(async () => {
    const startTs = new Date(`${start}T00:00:00`).toISOString()
    const endTs = new Date(`${end}T00:00:00`).toISOString()
    const [journal, moods, rituals, practices, goals, achievements, reflections, review] = await Promise.all([
      db.list<JournalEntry>('journal_entries', { filters: [{ col: 'entry_date', op: 'gte', value: start }, { col: 'entry_date', op: 'lt', value: end }] }),
      db.list<MoodEntry>('mood_entries', { filters: [{ col: 'recorded_at', op: 'gte', value: startTs }, { col: 'recorded_at', op: 'lt', value: endTs }] }),
      db.list<RitualCompletion>('ritual_completions', { filters: [{ col: 'ritual_date', op: 'gte', value: start }, { col: 'ritual_date', op: 'lt', value: end }] }),
      db.list<PracticeSession>('practices', { filters: [{ col: 'completed_at', op: 'gte', value: startTs }, { col: 'completed_at', op: 'lt', value: endTs }] }),
      db.list<Goal>('goals', {}),
      db.list<Achievement>('achievements', { filters: [{ col: 'occurred_on', op: 'gte', value: start }, { col: 'occurred_on', op: 'lt', value: end }] }),
      db.list<Reflection>('reflections', { filters: [{ col: 'created_at', op: 'gte', value: startTs }, { col: 'created_at', op: 'lt', value: endTs }] }),
      db.list<MonthlyReview>('monthly_reviews', { match: { month: start } }),
    ])
    const intentions = profile?.daily_intention && profile.intention_date?.startsWith(month) ? [profile.daily_intention] : []
    return { report: buildReport({ month, journal, moods, rituals, practices, goals, achievements, reflections, intentions }), review: review[0] ?? null }
  }, [month])
  const [highlights, setHighlights] = useState('')
  const [next, setNext] = useState('')
  const { run, busy } = useAction()
  useEffect(() => { setHighlights(data.data?.review?.highlights ?? ''); setNext(data.data?.review?.intention_next ?? '') }, [data.data])

  const save = () => run(async () => {
    const r = data.data!
    const row = await db.upsert<MonthlyReview>('monthly_reviews', { ...(r.review ? { id: r.review.id } : {}), month: start, snapshot: r.report as unknown as Record<string, unknown>, highlights, intention_next: next }, r.review ? 'id' : 'user_id,month')
    data.setData({ ...r, review: row })
  }, 'Report saved')

  const r = data.data?.report
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="size-4" /></IconButton>
          <span className="min-w-[10rem] text-center font-display text-xl">{fmt(cursor, 'MMMM yyyy')}</span>
          <IconButton label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="size-4" /></IconButton>
        </div>
        <div className="flex gap-2">
          <Button size="sm" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>Print / save as PDF</Button>
          {r && <Button size="sm" variant="ghost" onClick={() => downloadJSON({ report: r, highlights, intention_next: next }, `becoming-report-${month}.json`)}>Download data</Button>}
        </div>
      </div>
      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}
      {!r ? <Loading label="Gathering your month…" /> : (
        <article className="space-y-6">
          <header className="relative overflow-hidden rounded-[2rem] bg-linen px-8 py-12 sm:px-14 grain">
            <div className="absolute -right-16 -top-24 size-80 rounded-full bg-sage-100/80 blur-2xl" />
            <p className="eyebrow relative">The Becoming Report</p>
            <h2 className="relative mt-3 text-[3.4rem] leading-none sm:text-[4.6rem]">{fmt(`${month}-01`, 'MMMM')}<span className="italic text-ink-soft"> {fmt(`${month}-01`, 'yyyy')}</span></h2>
            <p className="relative mt-4 max-w-xl font-display text-xl italic text-ink-soft">{profile?.preferred_name ? `${profile.preferred_name}, h` : 'H'}ere is your month, gathered from what you actually recorded.</p>
            <div className="relative mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat n={r.journal.count} label="journal entries" />
              <Stat n={r.rituals.total} label="ritual practices" />
              <Stat n={r.mood.count} label="mood check-ins" />
              <Stat n={r.achievements.length} label="pieces of evidence" />
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-7">
              <p className="eyebrow mb-2">Journal</p>
              <p className="text-[15px]">{r.journal.count ? <>You wrote on <strong className="font-medium">{r.journal.activeDays}</strong> of {r.daysInMonth} days — about <strong className="font-medium">{r.journal.words.toLocaleString()}</strong> words.</> : 'No journal entries this month.'}</p>
              {r.journal.topTags.length > 0 && <p className="mt-3 text-[13.5px] text-ink-soft">Most used tags: {r.journal.topTags.map(([t, n]) => `#${t} (${n})`).join(', ')}</p>}
              {r.journal.favorites.length > 0 && <div className="mt-4"><p className="mb-1 text-[12.5px] font-medium text-ink-soft">Favorite entries</p><ul className="space-y-0.5 text-[14px]">{r.journal.favorites.map((f) => <li key={f.id}><Link className="hover:underline" to={`/inner-world/journal/${f.id}`}>{f.title}</Link> <span className="text-taupe-deep">· {fmt(f.date, 'MMM d')}</span></li>)}</ul></div>}
            </Card>
            <Card className="p-7">
              <p className="eyebrow mb-2">Moods recorded</p>
              {r.mood.count ? (
                <>
                  <p className="text-[15px]">Average check-in: <strong className="font-medium">{r.mood.average}</strong> / 5 ({MOODS[Math.round(r.mood.average!) - 1]?.label}) across {r.mood.count} check-ins.</p>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/60">{r.mood.distribution.map((d, i) => d.count > 0 && <div key={d.label} title={`${d.label}: ${d.count}`} style={{ width: `${(d.count / r.mood.count) * 100}%`, background: MOODS[i].tone }} />)}</div>
                  <p className="mt-2 text-[12.5px] text-ink-soft">{r.mood.distribution.filter((d) => d.count).map((d) => `${d.label} ${d.count}`).join(' · ')}</p>
                  {r.mood.topThemes.length > 0 && <p className="mt-3 text-[13.5px] text-ink-soft">Themes you named: {r.mood.topThemes.map(([t, n]) => `${t} (${n})`).join(', ')}</p>}
                </>
              ) : <p className="text-[15px]">No mood check-ins this month.</p>}
            </Card>
            <Card className="p-7">
              <p className="eyebrow mb-2">Rituals & practices</p>
              <p className="text-[15px]">{r.rituals.total ? <>{r.rituals.morning} morning and {r.rituals.evening} evening practices, on {r.rituals.activeDays} days.</> : 'No ritual practices completed.'}</p>
              {r.rituals.byPractice.length > 0 && <ul className="mt-3 space-y-0.5 text-[13.5px] text-ink-soft">{r.rituals.byPractice.map(([k, n]) => <li key={k}>{ritualLabel(k)} — {n}</li>)}</ul>}
              {r.practices.total > 0 && <p className="mt-4 text-[13.5px] text-ink-soft">Manifestation sessions: {r.practices.byMethod.map(([k, n]) => `${methodByKey(k)?.title ?? k} (${n})`).join(', ')}</p>}
            </Card>
            <Card className="p-7">
              <p className="eyebrow mb-2">Goals</p>
              <p className="text-[15px]">{r.goals.completed.length} completed · {r.goals.created} new · {r.goals.active} active now</p>
              {r.goals.completed.length > 0 && <ul className="mt-3 space-y-0.5 text-[14px]">{r.goals.completed.map((g) => <li key={g.id}>✓ <Link to={`/coach/goals/${g.id}`} className="hover:underline">{g.title}</Link></li>)}</ul>}
            </Card>
          </div>

          {(r.achievements.length > 0 || r.reflections.length > 0) && (
            <Card className="p-7">
              <div className="grid gap-8 md:grid-cols-2">
                <div><p className="eyebrow mb-3">Evidence & achievements</p><ul className="space-y-2">{r.achievements.map((a) => <li key={a.id} className="text-[14.5px]"><span className="font-display text-[1.2rem]">{a.title}</span><span className="block text-[12px] text-taupe-deep">{EVIDENCE_KINDS.find((k) => k.key === a.kind)?.label} · {fmt(a.date, 'MMM d')}</span></li>)}</ul>{!r.achievements.length && <p className="text-[14px] text-ink-soft">None recorded.</p>}</div>
                <div><p className="eyebrow mb-3">Important reflections</p><ul className="space-y-1 text-[14.5px]">{r.reflections.map((x) => <li key={x.id}>{x.title}</li>)}</ul>{!r.reflections.length && <p className="text-[14px] text-ink-soft">None recorded.</p>}</div>
              </div>
            </Card>
          )}

          <Card className="p-7">
            <p className="eyebrow mb-4">In my own words</p>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Highlights of this month"><Textarea rows={5} value={highlights} onChange={(e) => setHighlights(e.target.value)} className="print:border-none" /></Field>
              <Field label="My intention for next month"><Textarea rows={5} value={next} onChange={(e) => setNext(e.target.value)} className="print:border-none" /></Field>
            </div>
            {r.intentions.length > 0 && <p className="mt-4 text-[13.5px] text-ink-soft">Most recent daily intention: “{r.intentions[0]}”</p>}
            <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
              <Button variant="primary" icon={<Save className="size-4" />} loading={busy} onClick={save}>Save this report</Button>
              {data.data?.review && <span className="text-[12.5px] text-taupe-deep">Last saved {fmt(data.data.review.updated_at, 'MMM d, h:mm a')}</span>}
            </div>
          </Card>
          <p className="text-[12px] text-taupe-deep print:hidden">This report uses only counts, averages and your own saved words. {aiStatus.chat ? '' : 'A richer written reflection can be added once an AI model is connected.'}</p>
        </article>
      )}
    </div>
  )
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div><p className="font-display text-[3rem] leading-none">{n}</p><p className="mt-1 text-[12px] uppercase tracking-[0.16em] text-ink-soft">{label}</p></div>
)
