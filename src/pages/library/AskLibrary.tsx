import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { db } from '../../lib/db'
import type { PassageHit } from '../../lib/types'
import { keywordQuery } from '../../ai'
import { highlightParts } from '../../lib/utils'
import ChatPanel from '../../components/ChatPanel'
import { Button, Card, EmptyState, ErrorState, Input, Loading, PageHeader } from '../../components/ui'

export default function AskLibrary() {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PassageHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!q.trim()) return
    setLoading(true); setError(null)
    try { setHits(await db.rpc<PassageHit[]>('search_passages', { query: keywordQuery(q) || q, match_count: 10 })) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <Link to="/library" className="mb-6 inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Library</Link>
      <PageHeader eyebrow="Knowledge Library" title="Ask my library" intro="Ask a question and see exactly which passages in your saved sources are relevant. With an AI model connected, answers are written only from these passages, with citations." />

      <Card className="mb-10 p-6 sm:p-8">
        <p className="eyebrow mb-3">Find the sources (works now)</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search() }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-taupe" />
            <Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What does my library say about self-concept?" />
          </div>
          <Button type="submit" variant="primary" disabled={!q.trim()}>Find passages</Button>
        </form>
        <div className="mt-6">
          {loading ? <Loading label="Searching your sources…" /> : error ? <ErrorState message={error} /> : hits === null ? null : !hits.length ? (
            <EmptyState title="No matching passages" body="Becoming only answers from content it can actually read. Try other words, or add text to your sources." />
          ) : (
            <ol className="space-y-3">
              {hits.map((h, i) => (
                <li key={h.passage_id} className="rounded-2xl border border-beige/60 bg-white/70 p-4">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <Link to={`/library/${h.resource_id}?passage=${h.passage_id}`} className="font-medium hover:underline">[{i + 1}] {h.resource_title}</Link>
                    <span className="shrink-0 text-[12px] text-taupe-deep">{h.page_number ? `page ${h.page_number}` : `passage ${h.passage_index + 1}`}{h.resource_author ? ` · ${h.resource_author}` : ''}</span>
                  </div>
                  <p className="text-[14px] text-ink-soft">{highlightParts(h.snippet).map((s, j) => s.hit ? <mark key={j} className="bg-blush-100 text-ink">{s.text}</mark> : <span key={j}>{s.text}</span>)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <ChatPanel
        kind="library"
        title="Questions for my library"
        placeholder="Ask a question about your saved sources…"
        emptyTitle="Ask about your books and notes"
        emptyBody="Answers will only use passages retrieved from your library, each with a citation. Questions are saved even before an AI model is connected."
      />
    </>
  )
}
