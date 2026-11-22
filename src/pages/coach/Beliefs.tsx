import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, uuid } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { LimitingBelief } from '../../lib/types'
import { METHODS, methodByKey } from '../../data/content'
import { cx, fmt } from '../../lib/utils'
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea, useAction } from '../../components/ui'
import { AddButton, RowActions, useCrud } from '../../components/SimpleCrud'

const STATUSES: { key: LimitingBelief['status']; label: string }[] = [
  { key: 'exploring', label: 'Exploring' }, { key: 'softening', label: 'Softening' }, { key: 'released', label: 'Released' },
]

export default function Beliefs() {
  const list = useData(() => db.list<LimitingBelief>('limiting_beliefs', { order: [{ col: 'updated_at' }] }), [])
  const crud = useCrud<LimitingBelief>('limiting_beliefs', { setData: list.setData, label: 'Belief' })
  const [filter, setFilter] = useState<string | null>(null)
  const items = (list.data ?? []).filter((b) => !filter || b.status === filter)

  return (
    <div>
      <p className="mb-6 max-w-2xl text-[13.5px] text-ink-soft">A private, gentle space for beliefs that may be holding you back. This is a self-reflection tool, not therapy — if a belief feels heavy or painful, a licensed professional can help.</p>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!filter} onClick={() => setFilter(null)}>All</Chip>
          {STATUSES.map((s) => <Chip key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>{s.label}</Chip>)}
        </div>
        <AddButton onClick={() => crud.setEditing({ status: 'exploring', reflections: [] })}>Record a belief</AddButton>
      </div>
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Loading /> : !items.length ? <EmptyState title="Nothing recorded" body="Write down a belief, where it might come from, and a kinder alternative." /> : (
        <div className="space-y-4">{items.map((b) => <BeliefCard key={b.id} b={b} onEdit={() => crud.setEditing(b)} onDelete={() => crud.remove(b, b.belief)} onChange={(row) => list.setData((l) => l?.map((x) => (x.id === row.id ? row : x)))} />)}</div>
      )}
      {crud.modal('Record a belief', (f, set) => (
        <div className="space-y-4">
          <Field label="The belief"><Textarea rows={2} value={f.belief ?? ''} onChange={(e) => set({ belief: e.target.value })} placeholder="I’m not the kind of person who…" /></Field>
          <Field label="Why I think I have it"><Textarea rows={3} value={f.origin ?? ''} onChange={(e) => set({ origin: e.target.value })} /></Field>
          <Field label="A healthier alternative perspective"><Textarea rows={3} value={f.alternative ?? ''} onChange={(e) => set({ alternative: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Linked practice"><Select value={f.practice_key ?? ''} onChange={(e) => set({ practice_key: e.target.value || null })}><option value="">None</option>{METHODS.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}</Select></Field>
            <Field label="Where it is now"><Select value={f.status ?? 'exploring'} onChange={(e) => set({ status: e.target.value as LimitingBelief['status'] })}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Field>
          </div>
        </div>
      ), (f) => !!f.belief?.trim())}
    </div>
  )
}

function BeliefCard({ b, onEdit, onDelete, onChange }: { b: LimitingBelief; onEdit: () => void; onDelete: () => void; onChange: (b: LimitingBelief) => void }) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const { run, busy } = useAction()
  const add = () => run(async () => {
    const reflections = [...(b.reflections ?? []), { id: uuid(), date: new Date().toISOString(), text: text.trim() }]
    onChange(await db.update<LimitingBelief>('limiting_beliefs', b.id, { reflections })); setText('')
  }, 'Reflection added')
  const method = methodByKey(b.practice_key)
  return (
    <Card className="group p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cx('rounded-full px-2.5 py-0.5 text-[11px] font-medium', b.status === 'released' ? 'bg-sage-100 text-sage-deep' : b.status === 'softening' ? 'bg-blush-50 text-blush-deep' : 'bg-linen text-ink-soft')}>{STATUSES.find((s) => s.key === b.status)?.label}</span>
          <span className="text-[12px] text-taupe-deep">since {fmt(b.created_at)}</span>
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <p className={cx('mt-3 font-display text-[1.6rem] leading-snug', b.status === 'released' && 'text-taupe-deep line-through decoration-1')}>“{b.belief}”</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {b.origin && <div><p className="eyebrow mb-1">Where it may come from</p><p className="whitespace-pre-wrap text-[14px] text-ink-soft">{b.origin}</p></div>}
        {b.alternative && <div className="rounded-2xl bg-sage-50 p-4"><p className="eyebrow mb-1">A healthier perspective</p><p className="whitespace-pre-wrap font-display text-[1.2rem] italic">{b.alternative}</p></div>}
      </div>
      {method && <p className="mt-3 text-[13px]">Practice: <Link to={`/coach/methods/${method.key}`} className="underline decoration-sand underline-offset-2">{method.title}</Link></p>}
      <button onClick={() => setOpen(!open)} className="mt-4 text-[13px] text-ink-soft hover:text-ink cursor-pointer">{open ? 'Hide' : 'Show'} reflections over time ({b.reflections?.length ?? 0})</button>
      {open && (
        <div className="mt-3 animate-fade">
          <ol className="space-y-2 border-l border-beige pl-4">
            {(b.reflections ?? []).map((r) => <li key={r.id} className="text-[14px]"><p className="text-[11.5px] text-taupe-deep">{fmt(r.date, 'MMM d, yyyy')}</p><p className="whitespace-pre-wrap">{r.text}</p></li>)}
          </ol>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); text.trim() && add() }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="How does this belief feel now?" />
            <Button type="submit" loading={busy} disabled={!text.trim()}>Add</Button>
          </form>
        </div>
      )}
    </Card>
  )
}
