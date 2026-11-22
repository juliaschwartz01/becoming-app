import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { PracticeSession } from '../../lib/types'
import { MANIFESTATION_DISCLAIMER, METHODS } from '../../data/content'

export default function Methods() {
  const sessions = useData(() => db.list<PracticeSession>('practices', { select: 'id,method_key,completed_at', order: [{ col: 'completed_at' }], limit: 1000 }), [])
  const count = (k: string) => (sessions.data ?? []).filter((s) => s.method_key === k).length
  return (
    <div>
      <p className="mb-6 max-w-2xl text-[13.5px] text-ink-soft">{MANIFESTATION_DISCLAIMER} Each practice shows what psychology research says separately from where the idea comes from in spiritual teaching.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METHODS.map((m, i) => (
          <Link key={m.key} to={`/coach/methods/${m.key}`} className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift animate-rise" style={{ background: m.tone, animationDelay: `${i * 40}ms` }}>
            <span className="font-display text-[3.5rem] leading-none text-white/70">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="mt-auto text-[1.7rem] leading-tight">{m.title}</h3>
            <p className="mt-1 text-[13.5px] text-ink-soft">{m.subtitle}</p>
            <p className="mt-3 text-[11.5px] uppercase tracking-[0.18em] text-taupe-deep">{count(m.key) ? `${count(m.key)} session${count(m.key) > 1 ? 's' : ''}` : 'Not yet practised'}</p>
            <ArrowUpRight className="absolute right-5 top-5 size-5 text-ink-soft opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  )
}
