import { useState } from 'react'
import { Award, Heart, MessageCircleHeart, Mountain, Sparkle, Star } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Achievement, Goal, LifeChapter } from '../../lib/types'
import { EVIDENCE_KINDS } from '../../data/content'
import { fmt, today } from '../../lib/utils'
import { Chip, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea } from '../../components/ui'
import { AddButton, RowActions, useCrud } from '../../components/SimpleCrud'

const ICON: Record<string, typeof Star> = { achievement: Award, compliment: MessageCircleHeart, memory: Heart, victory: Star, challenge: Mountain, courage: Sparkle }
const TONE: Record<string, string> = { achievement: '#e1e7d9', compliment: '#f1dfd8', memory: '#efe2d6', victory: '#e9e0ea', challenge: '#e6dac8', courage: '#f5eee4' }

export default function Evidence() {
  const list = useData(() => db.list<Achievement>('achievements', { order: [{ col: 'occurred_on' }, { col: 'created_at' }] }), [])
  const goals = useData(() => db.list<Goal>('goals', {}), [])
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', {}), [])
  const [kind, setKind] = useState<string | null>(null)
  const crud = useCrud<Achievement>('achievements', { setData: list.setData, label: 'Evidence' })
  const items = (list.data ?? []).filter((a) => !kind || a.kind === kind)

  return (
    <div>
      <p className="mb-6 max-w-2xl text-[14px] text-ink-soft">Real proof of who you already are — achievements, kind words, happy memories, brave moments. When you ask Claude for encouragement, it can bring these real moments back to you.</p>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!kind} onClick={() => setKind(null)}>Everything</Chip>
          {EVIDENCE_KINDS.map((k) => <Chip key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>)}
        </div>
        <AddButton onClick={() => crud.setEditing({ kind: kind ?? 'achievement', occurred_on: today() })}>Add evidence</AddButton>
      </div>
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Loading /> : !items.length ? (
        <EmptyState title="Your wall is waiting" body="Start with something small you’re proud of. A compliment you remember. A moment you chose courage." />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {items.map((a, i) => {
            const Icon = ICON[a.kind] ?? Star
            return (
              <div key={a.id} className="group mb-4 break-inside-avoid rounded-3xl p-6 shadow-soft transition hover:shadow-lift animate-rise" style={{ background: TONE[a.kind] ?? '#efe6d8', transform: `rotate(${((i * 13) % 5 - 2) * 0.35}deg)` }}>
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-taupe-deep"><Icon className="size-3.5" />{EVIDENCE_KINDS.find((k) => k.key === a.kind)?.label}</span>
                  <RowActions onEdit={() => crud.setEditing(a)} onDelete={() => crud.remove(a, a.title)} />
                </div>
                <h3 className={a.kind === 'compliment' ? 'mt-2 font-display text-[1.5rem] italic leading-snug' : 'mt-2 text-[1.5rem] leading-tight'}>{a.kind === 'compliment' ? `“${a.title}”` : a.title}</h3>
                {a.description && <p className="mt-2 whitespace-pre-wrap text-[14px] text-ink-soft">{a.description}</p>}
                <p className="mt-4 text-[12px] text-taupe-deep">
                  {fmt(a.occurred_on, 'MMMM d, yyyy')}
                  {a.goal_id && ` · ${goals.data?.find((g) => g.id === a.goal_id)?.title ?? ''}`}
                  {a.chapter_id && ` · ${chapters.data?.find((c) => c.id === a.chapter_id)?.title ?? ''}`}
                  {a.is_breakthrough && ' · breakthrough'}
                </p>
              </div>
            )
          })}
        </div>
      )}
      {crud.modal('Add evidence', (f, set) => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">{EVIDENCE_KINDS.map((k) => <Chip key={k.key} active={f.kind === k.key} onClick={() => set({ kind: k.key })}>{k.label}</Chip>)}</div>
          <Field label={f.kind === 'compliment' ? 'What they said' : 'What happened'}><Input value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Details"><Textarea rows={4} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Who, where, how it felt…" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="When"><Input type="date" value={f.occurred_on ?? today()} onChange={(e) => set({ occurred_on: e.target.value || today() })} /></Field>
            <Field label="Goal"><Select value={f.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}><option value="">None</option>{(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></Field>
            <Field label="Chapter"><Select value={f.chapter_id ?? ''} onChange={(e) => set({ chapter_id: e.target.value || null })}><option value="">None</option>{(chapters.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          </div>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={!!f.is_breakthrough} onChange={(e) => set({ is_breakthrough: e.target.checked })} /> Mark as a personal breakthrough (shows on your timeline)</label>
        </div>
      ), (f) => !!f.title?.trim())}
    </div>
  )
}
