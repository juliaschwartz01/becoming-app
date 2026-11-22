import ChatPanel from '../../components/ChatPanel'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { Goal, LifeChapter } from '../../lib/types'
import { FUTURE_AREAS } from '../../data/content'
import { Chip, Select } from '../../components/ui'

export default function FutureMe() {
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', {}), [])
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' } }), [])
  const year = new Date().getFullYear()
  return (
    <>
      <ChatPanel
        kind="future_self"
        title="A conversation with future me"
        placeholder="Ask anything — how you got there, what your future self would tell you today…"
        newConversationDefaults={() => ({ context: { future_year: year + 5, areas: [] } })}
        contextExtra={(c) => ({ ...(c?.context ?? {}) })}
        emptyTitle="Meet the person you’re becoming"
        emptyBody="Choose a year, a chapter and the parts of life you want to explore. This is imaginative reflection — not a prediction."
        renderSetup={(conv, update) => {
          const ctx = (conv?.context ?? {}) as { future_year?: number; chapter_id?: string; areas?: string[]; goal_ids?: string[] }
          const set = (p: Partial<typeof ctx>) => update({ context: { ...ctx, ...p } })
          const areas = ctx.areas ?? []
          return (
            <div className="space-y-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ink-soft">Year</span>
                <Select className="h-9 w-auto text-[13px]" value={ctx.future_year ?? year + 5} onChange={(e) => set({ future_year: Number(e.target.value) })}>
                  {Array.from({ length: 20 }, (_, i) => year + 1 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
                <span className="ml-2 text-ink-soft">Chapter</span>
                <Select className="h-9 w-auto min-w-[10rem] text-[13px]" value={ctx.chapter_id ?? ''} onChange={(e) => set({ chapter_id: e.target.value || undefined })}>
                  <option value="">Any</option>{(chapters.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
                <span className="ml-2 text-ink-soft">Goal</span>
                <Select className="h-9 w-auto min-w-[10rem] text-[13px]" value={conv?.goal_id ?? ''} onChange={(e) => update({ goal_id: e.target.value || null })}>
                  <option value="">Any</option>{(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FUTURE_AREAS.map((a) => <Chip key={a} active={areas.includes(a)} onClick={() => set({ areas: areas.includes(a) ? areas.filter((x) => x !== a) : [...areas, a] })}>{a}</Chip>)}
              </div>
            </div>
          )
        }}
      />
      <p className="mt-6 max-w-3xl text-[12.5px] text-taupe-deep">Future Me is an imaginative reflection exercise. Anything your future self says is a creative perspective built from your own goals and words — never a prediction of what will happen. Live conversations use Claude through your own Claude account.</p>
    </>
  )
}
