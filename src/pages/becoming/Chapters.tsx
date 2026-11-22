import { Link } from 'react-router-dom'
import { BookHeart } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Goal, LifeChapter } from '../../lib/types'
import { fmt, splitLines } from '../../lib/utils'
import { Badge, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea } from '../../components/ui'
import { AddButton, useCrud } from '../../components/SimpleCrud'

const SUGGESTIONS = ['My New York Era', 'Becoming More Confident', 'My Dream Career', 'My Personal Growth', 'Living More Intentionally']
const TONES = ['#efe2d6', '#e1e7d9', '#f1dfd8', '#e9e0ea', '#e6dac8', '#e3e4d4']

export function ChapterForm({ f, set }: { f: Partial<LifeChapter>; set: (p: Partial<LifeChapter>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Chapter title"><Input value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="My New York Era" /></Field>
      {!f.id && <div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => set({ title: s })} className="rounded-full border border-dashed border-sand px-2.5 py-0.5 text-xs text-ink-soft hover:border-taupe cursor-pointer">{s}</button>)}</div>}
      <Field label="Description"><Textarea rows={4} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="What this season of life is about…" /></Field>
      <Field label="Chapter affirmations" hint="One per line."><Textarea rows={3} value={(f.affirmations ?? []).join('\n')} onChange={(e) => set({ affirmations: e.target.value.split('\n') })} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Status"><Select value={f.status ?? 'current'} onChange={(e) => set({ status: e.target.value as LifeChapter['status'] })}><option value="upcoming">Upcoming</option><option value="current">Current</option><option value="completed">Completed</option></Select></Field>
        <Field label="Began"><Input type="date" value={f.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value || null })} /></Field>
        <Field label="Ended"><Input type="date" value={f.end_date ?? ''} onChange={(e) => set({ end_date: e.target.value || null })} /></Field>
      </div>
    </div>
  )
}

export default function Chapters() {
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', { order: [{ col: 'created_at' }] }), [])
  const goals = useData(() => db.list<Goal>('goals', { select: 'id,chapter_id,status' }), [])
  const crud = useCrud<LifeChapter>('life_chapters', { setData: chapters.setData, label: 'Chapter', prepare: (f) => ({ ...f, affirmations: splitLines((f.affirmations ?? []).join('\n')) }) })

  return (
    <div>
      <div className="mb-6 flex justify-end"><AddButton onClick={() => crud.setEditing({ status: 'current', affirmations: [] })}>New chapter</AddButton></div>
      {chapters.error && <ErrorState message={chapters.error} onRetry={chapters.reload} />}
      {chapters.loading && !chapters.data ? <Loading /> : !chapters.data?.length ? (
        <EmptyState icon={<BookHeart className="size-7" strokeWidth={1.2} />} title="Name the chapter you’re living" body="A chapter gathers goals, boards, affirmations, milestones and journal entries around one season of your life." action={<AddButton onClick={() => crud.setEditing({ status: 'current', affirmations: [] })}>Begin a chapter</AddButton>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {chapters.data.map((c, i) => {
            const n = (goals.data ?? []).filter((g) => g.chapter_id === c.id).length
            return (
              <Link key={c.id} to={`/becoming/chapters/${c.id}`} className="group relative block min-h-[260px] overflow-hidden rounded-[2rem] p-8 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift grain" style={{ background: TONES[i % TONES.length] }}>
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center gap-2"><p className="eyebrow">Chapter {chapters.data!.length - i}</p>{c.status !== 'completed' && <Badge tone={c.status === 'current' ? 'sage' : 'linen'}>{c.status}</Badge>}</div>
                  <h3 className="mt-3 text-[2.4rem] leading-[1.02]">{c.title}</h3>
                  {c.description && <p className="mt-3 line-clamp-3 max-w-md text-[14.5px] text-ink-soft">{c.description}</p>}
                  {c.affirmations[0] && <p className="mt-4 font-display text-[1.2rem] italic">“{c.affirmations[0]}”</p>}
                  <p className="mt-auto pt-6 text-[12px] text-taupe-deep">{c.start_date ? fmt(c.start_date, 'MMM yyyy') : 'Begun'}{c.end_date ? ` – ${fmt(c.end_date, 'MMM yyyy')}` : ''} · {n} goal{n === 1 ? '' : 's'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {crud.modal('New chapter', (f, set) => <ChapterForm f={f} set={set} />, (f) => !!f.title?.trim())}
    </div>
  )
}
