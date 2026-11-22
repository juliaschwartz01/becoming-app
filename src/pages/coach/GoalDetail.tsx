import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Check, CheckCircle2, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { db, uuid } from '../../lib/db'
import { useAutosave, useData } from '../../lib/hooks'
import type { Goal, JournalEntry, LifeChapter, ManifestationPlan, PlanAction, PracticeSession, Reminder, VisionBoard } from '../../lib/types'
import { categoryLabel, methodByKey } from '../../data/content'
import { aiStatus } from '../../ai'
import { cx, fmt, splitLines } from '../../lib/utils'
import { Badge, Button, Card, ErrorState, Field, IconButton, Input, Loading, Modal, SaveStatus, Textarea, useAction, useFeedback } from '../../components/ui'
import { GoalForm } from './Goals'

type PlanDraft = Pick<ManifestationPlan, 'affirmations' | 'visualization' | 'journaling_prompts' | 'gratitude' | 'weekly_reflection' | 'actions'>
const emptyPlan: PlanDraft = { affirmations: [], visualization: '', journaling_prompts: [], gratitude: '', weekly_reflection: '', actions: [] }

export default function GoalDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const goal = useData(() => db.get<Goal>('goals', id!), [id])
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', {}), [])
  const related = useData(async () => {
    const [entries, practices, boards, reminders] = await Promise.all([
      db.list<JournalEntry>('journal_entries', { match: { goal_id: id }, order: [{ col: 'entry_date' }], limit: 10 }),
      db.list<PracticeSession>('practices', { match: { goal_id: id }, order: [{ col: 'completed_at' }], limit: 10 }),
      db.list<VisionBoard>('vision_boards', { match: { goal_id: id } }),
      db.list<Reminder>('reminders', { match: { goal_id: id } }),
    ])
    return { entries, practices, boards, reminders }
  }, [id])
  const [planId, setPlanId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanDraft | null>(null)
  const [editing, setEditing] = useState<Partial<Goal> | null>(null)
  const [newAction, setNewAction] = useState('')
  const { run, busy } = useAction()
  const { confirm } = useFeedback()

  useEffect(() => {
    db.list<ManifestationPlan>('manifestation_plans', { match: { goal_id: id } }).then((r) => {
      const p = r[0]
      setPlanId(p?.id ?? null)
      setPlan(p ? { affirmations: p.affirmations, visualization: p.visualization ?? '', journaling_prompts: p.journaling_prompts, gratitude: p.gratitude ?? '', weekly_reflection: p.weekly_reflection ?? '', actions: p.actions ?? [] } : emptyPlan)
    }).catch(() => setPlan(emptyPlan))
  }, [id])

  const autosave = useAutosave(plan, async (p) => {
    if (!p) return
    const row = await db.upsert<ManifestationPlan>('manifestation_plans', { ...(planId ? { id: planId } : {}), goal_id: id!, ...p, source: 'manual' }, planId ? 'id' : 'goal_id')
    setPlanId(row.id)
  }, { enabled: plan !== null })

  if (goal.error) return <ErrorState message={goal.error} onRetry={goal.reload} />
  if (goal.loading && !goal.data) return <Loading />
  const g = goal.data
  if (!g) return <ErrorState message="This goal could not be found." />

  const setP = (patch: Partial<PlanDraft>) => setPlan((p) => ({ ...(p ?? emptyPlan), ...patch }))
  const setStatus = (status: Goal['status']) => run(async () => {
    const row = await db.update<Goal>('goals', g.id, { status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    goal.setData(row)
    if (status === 'completed' && await confirm({ title: 'Beautiful. Add it to your Evidence Wall?', body: 'Save this completed goal as evidence of what you can do.', confirmLabel: 'Add to Evidence Wall' })) {
      await db.insert('achievements', { kind: 'achievement', title: g.title, description: g.description, goal_id: g.id, chapter_id: g.chapter_id, is_breakthrough: true })
    }
  }, status === 'completed' ? 'Goal completed' : status === 'archived' ? 'Goal archived' : 'Goal reactivated')
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this goal?', body: 'The goal and its plan will be permanently deleted. Linked journal entries and practices are kept but unlinked.', confirmLabel: 'Delete goal', danger: true }))) return
    run(async () => { await db.remove('goals', g.id); nav('/coach/goals') }, 'Goal deleted')
  }
  const toggleAction = (a: PlanAction) => setP({ actions: plan!.actions.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) })
  const addAction = () => { if (!newAction.trim()) return; setP({ actions: [...(plan?.actions ?? []), { id: uuid(), text: newAction.trim(), done: false }] }); setNewAction('') }

  return (
    <div>
      <Link to="/coach/goals" className="mb-8 inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Goals & plans</Link>
      <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2"><p className="eyebrow">{categoryLabel(g.category)}</p>{g.status !== 'active' && <Badge tone={g.status === 'completed' ? 'sage' : 'linen'}>{g.status}</Badge>}</div>
          <h1 className="text-[2.8rem] leading-[1.05] sm:text-[3.4rem]">{g.title}</h1>
          {g.description && <p className="mt-3 whitespace-pre-wrap text-ink-soft">{g.description}</p>}
          <p className="mt-3 text-[13px] text-taupe-deep">
            {g.target_date && <>Target {fmt(g.target_date)} · </>}
            {g.chapter_id && <>Chapter: <Link className="underline decoration-sand underline-offset-2" to={`/becoming/chapters/${g.chapter_id}`}>{chapters.data?.find((c) => c.id === g.chapter_id)?.title ?? '…'}</Link> · </>}
            Created {fmt(g.created_at)}{g.completed_at && <> · Completed {fmt(g.completed_at)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(g)}>Edit</Button>
          {g.status === 'active' && <Button size="sm" variant="primary" icon={<CheckCircle2 className="size-3.5" />} onClick={() => setStatus('completed')}>Mark complete</Button>}
          {g.status === 'active' && <Button size="sm" icon={<Archive className="size-3.5" />} onClick={() => setStatus('archived')}>Archive</Button>}
          {g.status !== 'active' && <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setStatus('active')}>Reactivate</Button>}
          <IconButton label="Delete goal" onClick={remove}><Trash2 className="size-4" /></IconButton>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.9rem]">Manifestation plan</h2>
            <SaveStatus state={autosave.state} error={autosave.error} />
          </div>
          {!plan ? <Loading /> : (
            <div className="space-y-5">
              <Card className="p-6">
                <p className="eyebrow mb-3">Practical actions</p>
                <ul className="space-y-1.5">
                  {plan.actions.map((a) => (
                    <li key={a.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/70">
                      <button aria-label={a.done ? 'Mark not done' : 'Mark done'} onClick={() => toggleAction(a)} className={cx('flex size-6 shrink-0 items-center justify-center rounded-full border cursor-pointer', a.done ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand')}>{a.done && <Check className="size-3" />}</button>
                      <span className={cx('flex-1 text-[15px]', a.done && 'text-taupe-deep line-through')}>{a.text}</span>
                      <IconButton label="Remove action" className="size-7 opacity-0 group-hover:opacity-100" onClick={() => setP({ actions: plan.actions.filter((x) => x.id !== a.id) })}><X className="size-3.5" /></IconButton>
                    </li>
                  ))}
                </ul>
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addAction() }}>
                  <Input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Add a small, concrete step" />
                  <Button type="submit" icon={<Plus className="size-4" />} disabled={!newAction.trim()}>Add</Button>
                </form>
              </Card>
              <Card className="space-y-5 p-6">
                <Field label="Daily affirmations" hint="One per line."><Textarea rows={4} value={plan.affirmations.join('\n')} onChange={(e) => setP({ affirmations: e.target.value.split('\n') })} onBlur={() => setP({ affirmations: splitLines(plan.affirmations.join('\n')) })} /></Field>
                <Field label="Visualization session" hint="The scene you return to when you visualize this goal."><Textarea rows={4} value={plan.visualization ?? ''} onChange={(e) => setP({ visualization: e.target.value })} /></Field>
                <Field label="Journaling prompts" hint="One per line."><Textarea rows={3} value={plan.journaling_prompts.join('\n')} onChange={(e) => setP({ journaling_prompts: e.target.value.split('\n') })} onBlur={() => setP({ journaling_prompts: splitLines(plan.journaling_prompts.join('\n')) })} /></Field>
                <Field label="Gratitude exercise"><Textarea rows={3} value={plan.gratitude ?? ''} onChange={(e) => setP({ gratitude: e.target.value })} /></Field>
                <Field label="Weekly reflection"><Textarea rows={3} value={plan.weekly_reflection ?? ''} onChange={(e) => setP({ weekly_reflection: e.target.value })} placeholder="Each Sunday: what moved forward, what felt aligned, what will I adjust?" /></Field>
              </Card>
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sand p-4 text-[13px] text-ink-soft">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-blush-deep" />
                <div>
                  <p className="font-medium text-ink">AI-generated plans</p>
                  <p>{aiStatus.chat ? 'Ask your coach to draft a plan for this goal, then edit it here.' : 'Requires an AI model, which isn’t connected. Your manual plan above is fully saved and works today.'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          {plan && plan.journaling_prompts.filter(Boolean).length > 0 && (
            <Card className="p-6">
              <p className="eyebrow mb-3">Write from this plan</p>
              <ul className="space-y-1.5">{plan.journaling_prompts.filter(Boolean).map((p) => <li key={p}><Link to={`/inner-world/journal/new?prompt=${encodeURIComponent(p)}`} className="block rounded-xl bg-linen/60 px-3 py-2 font-display text-[1.1rem] italic hover:bg-linen">{p}</Link></li>)}</ul>
            </Card>
          )}
          <Card className="p-6">
            <p className="eyebrow mb-3">Connected</p>
            {related.loading && !related.data ? <Loading label="Gathering…" /> : related.data && (
              <div className="space-y-4 text-[14px]">
                <Group title="Journal entries" empty="None linked yet" items={related.data.entries.map((e) => ({ to: `/inner-world/journal/${e.id}`, label: `${fmt(e.entry_date, 'MMM d')} — ${e.title || 'Untitled'}` }))} />
                <Group title="Practice sessions" empty="None yet" items={related.data.practices.map((p) => ({ to: `/coach/methods/${p.method_key}`, label: `${methodByKey(p.method_key)?.title ?? p.method_key} · ${fmt(p.completed_at, 'MMM d')}` }))} />
                <Group title="Vision boards" empty="None linked" items={related.data.boards.map((b) => ({ to: `/envision/board/${b.id}`, label: b.title }))} />
                <Group title="Reminders" empty="None" items={related.data.reminders.map((r) => ({ to: '/reminders', label: r.title }))} />
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit goal" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!editing?.title?.trim()} onClick={() => run(async () => {
        const { title, description, category, target_date, chapter_id } = editing!
        goal.setData(await db.update<Goal>('goals', g.id, { title, description, category, target_date, chapter_id })); setEditing(null)
      }, 'Goal saved')}>Save</Button></>}>
        {editing && <GoalForm f={editing} set={(p) => setEditing((e) => ({ ...e, ...p }))} chapters={chapters.data ?? []} />}
      </Modal>
    </div>
  )
}

function Group({ title, items, empty }: { title: string; items: { to: string; label: string }[]; empty: string }) {
  return (
    <div>
      <p className="mb-1 text-[12.5px] font-medium text-ink-soft">{title}</p>
      {items.length ? <ul className="space-y-0.5">{items.map((i, n) => <li key={n}><Link to={i.to} className="hover:underline">{i.label}</Link></li>)}</ul> : <p className="text-[13px] text-taupe-deep">{empty}</p>}
    </div>
  )
}
