import { useState } from 'react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Reflection } from '../../lib/types'
import { REFLECTION_KINDS } from '../../data/content'
import { fmt } from '../../lib/utils'
import { Card, Chip, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea } from '../../components/ui'
import { AddButton, RowActions, useCrud } from '../../components/SimpleCrud'

export default function Reflections() {
  const list = useData(() => db.list<Reflection>('reflections', { order: [{ col: 'created_at' }] }), [])
  const [kind, setKind] = useState<string | null>(null)
  const crud = useCrud<Reflection>('reflections', { setData: list.setData, label: 'Discovery' })
  const items = (list.data ?? []).filter((r) => !kind || r.kind === kind)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!kind} onClick={() => setKind(null)}>Everything</Chip>
          {REFLECTION_KINDS.map((k) => <Chip key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>)}
        </div>
        <AddButton onClick={() => crud.setEditing({ kind: kind ?? 'realization' })}>New discovery</AddButton>
      </div>
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Loading /> : !items.length ? (
        <EmptyState title="Discoveries about yourself" body="What motivates you, what you’re learning, realizations, fears you’re working through, practices that help. Save them here." />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {items.map((r) => (
            <Card key={r.id} className="group mb-4 break-inside-avoid p-6">
              <div className="flex items-start justify-between gap-2">
                <p className="eyebrow">{REFLECTION_KINDS.find((k) => k.key === r.kind)?.label ?? r.kind}</p>
                <RowActions onEdit={() => crud.setEditing(r)} onDelete={() => crud.remove(r, r.title)} />
              </div>
              <h3 className="mt-1 text-[1.45rem] leading-tight">{r.title}</h3>
              {r.body && <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-ink-soft">{r.body}</p>}
              <p className="mt-3 text-[11.5px] text-taupe-deep">{fmt(r.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
      {crud.modal('New discovery', (f, set) => (
        <div className="space-y-4">
          <Field label="Kind"><Select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{REFLECTION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</Select></Field>
          <Field label="In a sentence"><Input value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="I do my best thinking on long walks" /></Field>
          <Field label="More detail"><Textarea rows={5} value={f.body ?? ''} onChange={(e) => set({ body: e.target.value })} /></Field>
        </div>
      ), (f) => !!f.title?.trim())}
    </div>
  )
}
