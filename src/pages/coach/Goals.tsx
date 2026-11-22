import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Target } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Goal, GoalStatus, LifeChapter, ManifestationPlan } from '../../lib/types'
import { CATEGORIES, CATEGORY_TONES, categoryLabel } from '../../data/content'
import { fmt } from '../../lib/utils'
import { Chip, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea } from '../../components/ui'
import { AddButton, useCrud } from '../../components/SimpleCrud'

export function GoalForm({ f, set, chapters }: { f: Partial<Goal>; set: (p: Partial<Goal>) => void; chapters: LifeChapter[] }) {
  return (
    <div className="space-y-4">
      <Field label="What are you calling in?"><Input value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Land a creative director role in New York" /></Field>
      <Field label="Why it matters / what it looks like"><Textarea rows={4} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category"><Select value={f.category ?? 'personal-growth'} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        <Field label="Target date (optional)"><Input type="date" value={f.target_date ?? ''} onChange={(e) => set({ target_date: e.target.value || null })} /></Field>
        <Field label="Life chapter" className="sm:col-span-2"><Select value={f.chapter_id ?? ''} onChange={(e) => set({ chapter_id: e.target.value || null })}><option value="">None</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
      </div>
    </div>
  )
}

export default function Goals() {
  const [status, setStatus] = useState<GoalStatus>('active')
  const [cat, setCat] = useState<string | null>(null)
  const goals = useData(() => db.list<Goal>('goals', { match: { status }, order: [{ col: 'updated_at' }] }), [status])
  const plans = useData(() => db.list<ManifestationPlan>('manifestation_plans', {}), [])
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', {}), [])
  const crud = useCrud<Goal>('goals', { setData: goals.setData, label: 'Goal' })
  const items = (goals.data ?? []).filter((g) => !cat || g.category === cat)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(['active', 'completed', 'archived'] as GoalStatus[]).map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</Chip>)}
          <span className="mx-1 w-px bg-beige" />
          <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
          {CATEGORIES.map((c) => <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>)}
        </div>
        <AddButton onClick={() => crud.setEditing({ category: cat ?? 'personal-growth', status: 'active' })}>New goal</AddButton>
      </div>
      {goals.error && <ErrorState message={goals.error} onRetry={goals.reload} />}
      {goals.loading && !goals.data ? <Loading /> : !items.length ? (
        <EmptyState icon={<Target className="size-7" strokeWidth={1.2} />} title={status === 'active' ? 'Name what you’re calling in' : `No ${status} goals`} body={status === 'active' ? 'Create a goal, then build a plan of affirmations, visualizations, prompts and practical actions.' : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => {
            const plan = plans.data?.find((p) => p.goal_id === g.id)
            const done = plan?.actions.filter((a) => a.done).length ?? 0
            const total = plan?.actions.length ?? 0
            return (
              <Link key={g.id} to={`/coach/goals/${g.id}`} className="group flex min-h-[200px] flex-col rounded-3xl p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift" style={{ background: CATEGORY_TONES[g.category] ?? '#efe6d8' }}>
                <p className="eyebrow">{categoryLabel(g.category)}</p>
                <h3 className="mt-2 text-[1.6rem] leading-tight">{g.title}</h3>
                {g.description && <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-soft">{g.description}</p>}
                <div className="mt-auto pt-5">
                  {total > 0 ? (
                    <>
                      <div className="h-1 overflow-hidden rounded-full bg-white/60"><div className="h-full bg-sage-deep" style={{ width: `${(done / total) * 100}%` }} /></div>
                      <p className="mt-1.5 text-[12px] text-ink-soft">{done} of {total} actions{g.target_date ? ` · by ${fmt(g.target_date)}` : ''}</p>
                    </>
                  ) : <p className="text-[12px] text-ink-soft">{plan ? 'Plan started' : 'No plan yet'}{g.target_date ? ` · by ${fmt(g.target_date)}` : ''}</p>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {crud.modal('New goal', (f, set) => <GoalForm f={f} set={set} chapters={chapters.data ?? []} />, (f) => !!f.title?.trim())}
    </div>
  )
}
