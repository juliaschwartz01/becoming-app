import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Achievement, BoardElement, Goal, JournalEntry, LifeChapter, Milestone, VisionBoard, VisionImage } from '../../lib/types'
import { categoryLabel } from '../../data/content'
import { cx, fmt, splitLines } from '../../lib/utils'
import { Button, Card, ErrorState, IconButton, Input, Loading, Modal, Select, SectionTitle, useAction, useFeedback } from '../../components/ui'
import { ChapterForm } from './Chapters'
import { Thumb } from '../envision/Envision'

export default function ChapterPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const chapter = useData(() => db.get<LifeChapter>('life_chapters', id!), [id])
  const data = useData(async () => {
    const [goals, allGoals, milestones, boards, entries, evidence, images] = await Promise.all([
      db.list<Goal>('goals', { match: { chapter_id: id }, order: [{ col: 'created_at' }] }),
      db.list<Goal>('goals', { match: { status: 'active' } }),
      db.list<Milestone>('milestones', { match: { chapter_id: id }, order: [{ col: 'due_date', asc: true }] }),
      db.list<VisionBoard>('vision_boards', { match: { chapter_id: id } }),
      db.list<JournalEntry>('journal_entries', { match: { chapter_id: id }, order: [{ col: 'entry_date' }] }),
      db.list<Achievement>('achievements', { match: { chapter_id: id }, order: [{ col: 'occurred_on' }] }),
      db.list<VisionImage>('vision_images', {}),
    ])
    const boardIds = boards.map((b) => b.id)
    const els = boardIds.length ? await db.list<BoardElement>('vision_board_elements', { filters: [{ col: 'board_id', op: 'in', value: boardIds }, { col: 'type', op: 'eq', value: 'image' }] }) : []
    const imageIds = new Set(els.map((e) => e.image_id))
    return { goals, allGoals, milestones, boards, entries, evidence, images: images.filter((i) => imageIds.has(i.id) || i.id === chapter.data?.cover_image_id) }
  }, [id])
  const [editing, setEditing] = useState<Partial<LifeChapter> | null>(null)
  const [milestone, setMilestone] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')
  const [linkGoal, setLinkGoal] = useState('')
  const { run, busy } = useAction()
  const { confirm } = useFeedback()

  if (chapter.error) return <ErrorState message={chapter.error} onRetry={chapter.reload} />
  if (chapter.loading && !chapter.data) return <Loading />
  const c = chapter.data
  if (!c) return <ErrorState message="This chapter could not be found." />
  const d = data.data

  const addMilestone = () => run(async () => {
    const row = await db.insert<Milestone>('milestones', { chapter_id: c.id, title: milestone.trim(), due_date: milestoneDate || null })
    data.setData((x) => x && { ...x, milestones: [...x.milestones, row] }); setMilestone(''); setMilestoneDate('')
  }, 'Milestone added')
  const toggleMilestone = (m: Milestone) => run(async () => {
    const row = await db.update<Milestone>('milestones', m.id, { done: !m.done, done_at: !m.done ? new Date().toISOString() : null })
    data.setData((x) => x && { ...x, milestones: x.milestones.map((y) => (y.id === m.id ? row : y)) })
  }, m.done ? undefined : 'Milestone reached')
  const removeMilestone = (m: Milestone) => run(async () => {
    await db.remove('milestones', m.id)
    data.setData((x) => x && { ...x, milestones: x.milestones.filter((y) => y.id !== m.id) })
  })
  const attachGoal = () => run(async () => {
    const row = await db.update<Goal>('goals', linkGoal, { chapter_id: c.id })
    data.setData((x) => x && { ...x, goals: [...x.goals, row] }); setLinkGoal('')
  }, 'Goal linked')
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this chapter?', body: 'The chapter and its milestones will be deleted. Linked goals, boards, entries and evidence are kept but unlinked.', confirmLabel: 'Delete chapter', danger: true }))) return
    run(async () => { await db.remove('life_chapters', c.id); nav('/becoming/chapters') }, 'Chapter deleted')
  }

  return (
    <div>
      <Link to="/becoming/chapters" className="mb-8 inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Life chapters</Link>
      <header className="relative mb-10 overflow-hidden rounded-[2rem] bg-linen px-7 py-12 sm:px-12 grain">
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-blush-100/70 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">{c.status} chapter{c.start_date ? ` · since ${fmt(c.start_date, 'MMMM yyyy')}` : ''}{c.end_date ? ` – ${fmt(c.end_date, 'MMMM yyyy')}` : ''}</p>
            <h1 className="text-[3rem] leading-none sm:text-[4.2rem]">{c.title}</h1>
            {c.description && <p className="mt-4 whitespace-pre-wrap text-[15px] text-ink-soft">{c.description}</p>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(c)}>Edit</Button>
            <IconButton label="Delete chapter" onClick={remove}><Trash2 className="size-4" /></IconButton>
          </div>
        </div>
        {c.affirmations.length > 0 && <div className="relative mt-8 flex flex-wrap gap-3">{c.affirmations.map((a) => <span key={a} className="rounded-full bg-ivory/80 px-4 py-2 font-display text-[1.15rem] italic">“{a}”</span>)}</div>}
      </header>

      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}
      {!d ? <Loading /> : (
        <div className="grid gap-8 lg:grid-cols-2">
          {d.images.length > 0 && (
            <section className="lg:col-span-2">
              <SectionTitle>Images</SectionTitle>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{d.images.slice(0, 12).map((i) => <div key={i.id} className="aspect-square overflow-hidden rounded-xl"><Thumb path={i.storage_path} /></div>)}</div>
            </section>
          )}
          <Card className="p-6">
            <SectionTitle>Goals</SectionTitle>
            <ul className="space-y-1.5">{d.goals.map((g) => <li key={g.id}><Link to={`/coach/goals/${g.id}`} className="flex justify-between rounded-xl bg-white/70 px-3 py-2 hover:bg-white"><span className={cx(g.status === 'completed' && 'line-through text-ink-soft')}>{g.title}</span><span className="text-[12px] text-taupe-deep">{categoryLabel(g.category)}</span></Link></li>)}</ul>
            {!d.goals.length && <p className="text-[14px] text-ink-soft">No goals in this chapter yet.</p>}
            <div className="mt-3 flex gap-2">
              <Select value={linkGoal} onChange={(e) => setLinkGoal(e.target.value)} className="h-9 text-[13px]"><option value="">Link an active goal…</option>{d.allGoals.filter((g) => g.chapter_id !== c.id).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select>
              <Button size="sm" disabled={!linkGoal} onClick={attachGoal}>Link</Button>
            </div>
          </Card>
          <Card className="p-6">
            <SectionTitle>Milestones</SectionTitle>
            <ul className="space-y-1.5">
              {d.milestones.map((m) => (
                <li key={m.id} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/70">
                  <button aria-label="Toggle milestone" onClick={() => toggleMilestone(m)} className={cx('flex size-6 shrink-0 items-center justify-center rounded-full border cursor-pointer', m.done ? 'border-sage-deep bg-sage-deep text-white' : 'border-sand')}>{m.done && <Check className="size-3" />}</button>
                  <span className={cx('flex-1', m.done && 'text-ink-soft line-through')}>{m.title}</span>
                  {m.due_date && <span className="text-[12px] text-taupe-deep">{fmt(m.due_date, 'MMM d')}</span>}
                  <IconButton label="Delete milestone" className="size-7 opacity-0 group-hover:opacity-100" onClick={() => removeMilestone(m)}><Trash2 className="size-3.5" /></IconButton>
                </li>
              ))}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); milestone.trim() && addMilestone() }}>
              <Input className="h-9 text-[14px]" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="Add a milestone" />
              <Input className="h-9 w-36 text-[13px]" type="date" value={milestoneDate} onChange={(e) => setMilestoneDate(e.target.value)} aria-label="Milestone date" />
              <Button size="sm" type="submit" icon={<Plus className="size-3.5" />} disabled={!milestone.trim()}>Add</Button>
            </form>
          </Card>
          <Card className="p-6">
            <SectionTitle action={<Link to="/envision" className="text-[13px] text-ink-soft">Studio →</Link>}>Vision boards</SectionTitle>
            {d.boards.length ? <ul className="space-y-1">{d.boards.map((b) => <li key={b.id}><Link to={`/envision/board/${b.id}`} className="hover:underline">{b.title}</Link></li>)}</ul> : <p className="text-[14px] text-ink-soft">Link a board to this chapter from its board settings.</p>}
          </Card>
          <Card className="p-6">
            <SectionTitle action={<Link to="/becoming/evidence" className="text-[13px] text-ink-soft">Wall →</Link>}>Evidence & reflections</SectionTitle>
            {d.evidence.length ? <ul className="space-y-1.5">{d.evidence.map((e) => <li key={e.id} className="text-[14px]"><span className="font-medium">{e.title}</span> <span className="text-taupe-deep">· {fmt(e.occurred_on)}</span></li>)}</ul> : <p className="text-[14px] text-ink-soft">No evidence linked yet.</p>}
          </Card>
          <Card className="p-6 lg:col-span-2">
            <SectionTitle action={<Link to="/inner-world/journal/new" className="text-[13px] text-ink-soft">Write →</Link>}>Related journal entries</SectionTitle>
            {d.entries.length ? (
              <div className="grid gap-3 md:grid-cols-2">{d.entries.map((e) => <Link key={e.id} to={`/inner-world/journal/${e.id}`} className="rounded-2xl bg-white/70 p-4 hover:bg-white"><p className="text-[12px] text-taupe-deep">{fmt(e.entry_date)}</p><p className="font-display text-xl">{e.title || 'Untitled'}</p><p className="line-clamp-2 text-[13.5px] text-ink-soft">{e.body}</p></Link>)}</div>
            ) : <p className="text-[14px] text-ink-soft">Choose this chapter on a journal entry to see it here.</p>}
          </Card>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit chapter" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} disabled={!editing?.title?.trim()} onClick={() => run(async () => {
        const e = editing!
        chapter.setData(await db.update<LifeChapter>('life_chapters', c.id, { title: e.title, description: e.description, affirmations: splitLines((e.affirmations ?? []).join('\n')), status: e.status, start_date: e.start_date, end_date: e.end_date }))
        setEditing(null)
      }, 'Chapter saved')}>Save</Button></>}>
        {editing && <ChapterForm f={editing} set={(p) => setEditing((x) => ({ ...x, ...p }))} />}
      </Modal>
    </div>
  )
}
