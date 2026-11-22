import { Link } from 'react-router-dom'
import ChatPanel from '../../components/ChatPanel'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Goal } from '../../lib/types'
import { COACH_STARTERS, MANIFESTATION_DISCLAIMER, METHODS } from '../../data/content'
import { Card, Select } from '../../components/ui'

export default function CoachChat() {
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' }, order: [{ col: 'updated_at' }] }), [])
  return (
    <div className="space-y-8">
      <ChatPanel
        kind="coach"
        title="Your manifestation coach"
        placeholder="Ask about a practice, a goal, or something from your library…"
        starters={COACH_STARTERS}
        emptyTitle="What would you like to work on?"
        emptyBody="Your coach draws on your goals, saved memories, journal reflections and Knowledge Library — and will cite the sources it uses."
        renderSetup={(conv, update) => (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
            <span>Focus on goal</span>
            <Select className="h-9 w-auto min-w-[12rem] text-[13px]" value={conv?.goal_id ?? ''} onChange={(e) => update({ goal_id: e.target.value || null })}>
              <option value="">Any / none</option>
              {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </div>
        )}
      />
      <Card className="p-6">
        <p className="eyebrow mb-2">Practise now — no AI needed</p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => <Link key={m.key} to={`/coach/methods/${m.key}`} className="rounded-full border border-beige bg-white/70 px-3 py-1.5 text-[13px] text-ink-soft hover:border-sand hover:text-ink">{m.title}</Link>)}
        </div>
        <p className="mt-4 text-[12px] text-taupe-deep">{MANIFESTATION_DISCLAIMER}</p>
      </Card>
    </div>
  )
}
