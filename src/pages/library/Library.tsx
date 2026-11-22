import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, FileText, Film, Image as ImageIcon, Link2, MessageCircleQuestion, NotebookPen, Plus, Quote, Search, Star, Upload } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/hooks'
import type { KnowledgeResource, PassageHit } from '../../lib/types'
import { RESOURCE_CATEGORIES, RESOURCE_TYPES } from '../../data/content'
import { canExtract, extractText } from '../../lib/extract'
import { guessType, replacePassages, uploadKnowledgeFile } from '../../lib/knowledge'
import { bytes, cx, fmt, highlightParts } from '../../lib/utils'
import { Button, Card, Chip, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, TagInput, Textarea, useFeedback } from '../../components/ui'

const ICONS: Record<string, typeof FileText> = { pdf: FileText, book: BookOpen, document: FileText, note: NotebookPen, quote: Quote, tiktok: Film, article: Link2, video: Film, transcript: FileText, screenshot: ImageIcon }
const TONES: Record<string, string> = { pdf: '#efe2d6', book: '#e6dac8', document: '#f1e9df', note: '#e1e7d9', quote: '#f1dfd8', tiktok: '#e9e0ea', article: '#e3e4d4', video: '#e9e0ea', transcript: '#efe6d8', screenshot: '#ecdcd3' }

export default function Library() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const resources = useData(() => db.list<KnowledgeResource>('knowledge_resources', {
    order: [{ col: 'created_at' }],
    search: query ? { col: 'search', text: query } : undefined,
    match: { ...(type ? { type } : {}), ...(category ? { category } : {}) },
  }), [query, type, category])
  const passages = useData(() => query ? db.rpc<PassageHit[]>('search_passages', { query, match_count: 12 }) : Promise.resolve([]), [query])

  return (
    <>
      <PageHeader eyebrow="Knowledge Library" title="Your teachings" intro="Books, notes, quotes, videos and transcripts on manifestation and personal growth — searchable, and kept separate from what Becoming knows about you."
        actions={<>
          <Link to="/library/ask"><Button icon={<MessageCircleQuestion className="size-4" />}>Ask my library</Button></Link>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add to library</Button>
        </>} />

      <form className="relative mb-4" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()) }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-taupe" />
        <Input className="h-12 rounded-full pl-11 text-[15px]" placeholder="Search titles, authors, notes and the full text of your documents…" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setQuery('') }} />
      </form>
      <div className="mb-8 flex flex-wrap gap-1.5">
        <Chip active={!type} onClick={() => setType(null)}>All types</Chip>
        {RESOURCE_TYPES.map((t) => <Chip key={t.key} active={type === t.key} onClick={() => setType(type === t.key ? null : t.key)}>{t.label}</Chip>)}
        <Select className="ml-auto h-8 w-auto rounded-full text-[13px]" value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)} aria-label="Category">
          <option value="">All categories</option>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {query && (
        <section className="mb-10">
          <p className="eyebrow mb-3">Passages matching “{query}”</p>
          {passages.loading ? <Loading label="Searching…" /> : passages.error ? <ErrorState message={passages.error} /> : !passages.data?.length ? <p className="text-[14px] text-ink-soft">No passages inside your documents match.</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {passages.data.map((p) => (
                <Link key={p.passage_id} to={`/library/${p.resource_id}?passage=${p.passage_id}`}>
                  <Card className="h-full p-4 transition hover:shadow-lift">
                    <p className="text-[12.5px] font-medium">{p.resource_title}{p.page_number ? ` · page ${p.page_number}` : ''}</p>
                    <p className="mt-1 text-[13.5px] text-ink-soft">{highlightParts(p.snippet).map((s, i) => s.hit ? <mark key={i} className="bg-blush-100 text-ink">{s.text}</mark> : <span key={i}>{s.text}</span>)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {resources.error && <ErrorState message={resources.error} onRetry={resources.reload} />}
      {resources.loading && !resources.data ? <Loading /> : !resources.data?.length ? (
        <EmptyState icon={<BookOpen className="size-7" strokeWidth={1.2} />} title={query || type || category ? 'Nothing matches' : 'Begin your library'} body="Upload a PDF or e-book, save a TikTok or article link with your notes, paste a quote or a transcript." action={<Button variant="primary" onClick={() => setAdding(true)}>Add your first source</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.data.map((r) => {
            const Icon = ICONS[r.type] ?? FileText
            return (
              <Link key={r.id} to={`/library/${r.id}`} className="group">
                <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-beige/60 bg-white/60 shadow-soft transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
                  <div className="relative flex h-28 items-end p-5" style={{ background: TONES[r.type] ?? '#efe6d8' }}>
                    <Icon className="absolute right-5 top-5 size-5 text-ink-soft" strokeWidth={1.4} />
                    <p className="eyebrow">{RESOURCE_TYPES.find((t) => t.key === r.type)?.label ?? r.type}</p>
                    {r.favorite && <Star className="absolute left-5 top-5 size-4 fill-blush text-blush" />}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {r.type === 'quote' ? <p className="font-display text-[1.35rem] italic leading-snug line-clamp-4">“{r.description || r.title}”</p> : <h3 className="text-[1.45rem] leading-tight line-clamp-2">{r.title}</h3>}
                    {r.author && <p className="mt-1 text-[13px] text-ink-soft">{r.author}</p>}
                    {r.type !== 'quote' && r.description && <p className="mt-2 line-clamp-2 text-[13.5px] text-ink-soft">{r.description}</p>}
                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-4 text-[11.5px] text-taupe-deep">
                      <span>{r.category}</span><span>·</span><span>{fmt(r.created_at, 'MMM d, yyyy')}</span>
                      {r.extraction_status === 'extracted' && <><span>·</span><span className="text-sage-deep">searchable{r.page_count ? ` · ${r.page_count} pp` : ''}</span></>}
                      {r.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <AddResource open={adding} onClose={() => setAdding(false)} onAdded={(r) => { resources.setData((l) => [r, ...(l ?? [])]); setAdding(false) }} />
    </>
  )
}

type Kind = 'file' | 'link' | 'note' | 'quote'

function AddResource({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (r: KnowledgeResource) => void }) {
  const nav = useNavigate()
  const { toast } = useFeedback()
  const [kind, setKind] = useState<Kind>('file')
  const [file, setFile] = useState<File | null>(null)
  const [f, setF] = useState<Partial<KnowledgeResource> & { text?: string }>({ category: 'manifestation', tags: [] })
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const reset = () => { setFile(null); setF({ category: 'manifestation', tags: [] }); setStatus(null); setKind('file') }
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const linkType = useMemo(() => (f.url && /tiktok\.com/i.test(f.url) ? 'tiktok' : f.url && /youtu\.?be|vimeo/i.test(f.url) ? 'video' : 'article'), [f.url])

  const canSave = kind === 'file' ? !!file : kind === 'link' ? !!f.url?.trim() : kind === 'quote' ? !!f.text?.trim() : !!(f.title?.trim() && f.text?.trim())

  const save = async () => {
    setBusy(true)
    let createdPath: string | null = null
    try {
      let resource: Partial<KnowledgeResource> = { title: f.title?.trim() || '', author: f.author || null, description: f.description || null, category: f.category ?? 'manifestation', tags: f.tags ?? [], personal_notes: f.personal_notes || null }
      let pages: { page: number | null; text: string }[] = []
      if (kind === 'file' && file) {
        setStatus('Uploading to your private storage…')
        createdPath = await uploadKnowledgeFile(file)
        resource = { ...resource, title: resource.title || file.name.replace(/\.[^.]+$/, ''), type: f.type || guessType(file), storage_path: createdPath, file_name: file.name, mime_type: file.type || null, file_size: file.size }
        if (canExtract(file)) {
          setStatus('Reading the text in your browser…')
          const ex = await extractText(file)
          resource.extraction_status = ex.status
          resource.page_count = ex.pageCount ?? null
          pages = ex.pages
          if (ex.message) toast(ex.message, ex.status === 'extracted' ? 'ok' : 'info')
        } else resource.extraction_status = 'unsupported'
      }
      if (kind === 'link') resource = { ...resource, type: f.type || linkType, url: f.url!.trim(), title: resource.title || f.url!.trim(), extraction_status: f.text?.trim() ? 'manual' : 'none' }
      if (kind === 'note') resource = { ...resource, type: 'note', extraction_status: 'manual' }
      if (kind === 'quote') resource = { ...resource, type: 'quote', title: resource.title || f.text!.trim().slice(0, 80), description: f.text!.trim(), extraction_status: 'manual' }
      if (kind !== 'file' && f.text?.trim()) pages = [{ page: null, text: f.text }]
      if (kind === 'file' && f.text?.trim() && !pages.length) { pages = [{ page: null, text: f.text }]; resource.extraction_status = 'manual' }

      setStatus('Saving…')
      const row = await db.insert<KnowledgeResource>('knowledge_resources', resource)
      if (pages.length) {
        setStatus('Making it searchable…')
        await replacePassages(row.id, pages)
      }
      toast('Added to your library')
      onAdded(row)
      reset()
      nav(`/library/${row.id}`)
    } catch (e) {
      if (createdPath) await db.removeFiles('knowledge', [createdPath]).catch(() => {})
      toast((e as Error).message, 'error')
    } finally { setBusy(false); setStatus(null) }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Add to your library" wide footer={<>
      {status && <span className="mr-auto self-center text-[13px] text-ink-soft">{status}</span>}
      <Button variant="ghost" onClick={() => { onClose(); reset() }}>Cancel</Button>
      <Button variant="primary" loading={busy} disabled={!canSave} onClick={save}>Add</Button>
    </>}>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {([['file', 'Upload a file'], ['link', 'Save a link'], ['note', 'Write a note'], ['quote', 'Save a quote']] as [Kind, string][]).map(([k, l]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}
      </div>
      <div className="space-y-4">
        {kind === 'file' && (
          <div>
            <input ref={input} type="file" className="hidden" accept=".pdf,.epub,.docx,.txt,.md,.markdown,.html,.htm,video/*,audio/*,image/*" onChange={(e) => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !f.title) set({ title: x.name.replace(/\.[^.]+$/, '') }) }} />
            <button type="button" onClick={() => input.current?.click()} className={cx('flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition cursor-pointer', file ? 'border-sage bg-sage-50' : 'border-sand hover:border-taupe')}>
              <Upload className="mb-2 size-5 text-taupe-deep" />
              {file ? <><p className="font-medium">{file.name}</p><p className="text-[12.5px] text-ink-soft">{bytes(file.size)} · {canExtract(file) ? 'text will be extracted for search' : 'stored privately; add notes or a transcript below'}</p></> : <><p className="font-medium">Choose a file</p><p className="text-[12.5px] text-ink-soft">PDF, EPUB, DOCX, TXT, Markdown, video, audio or screenshots · up to 50 MB</p></>}
            </button>
            <p className="mt-2 text-[12px] text-taupe-deep">Text is read in your browser. Scanned (image-only) PDFs, images and videos can’t be read automatically — add a transcript or notes instead.</p>
          </div>
        )}
        {kind === 'link' && (
          <>
            <Field label="Link" hint={linkType === 'tiktok' ? 'Becoming can’t open or transcribe TikTok videos automatically. Paste the transcript or your notes below so they’re searchable.' : 'The page itself isn’t fetched. Add the key ideas or transcript below to make it searchable.'}>
              <Input value={f.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://www.tiktok.com/@…" />
            </Field>
          </>
        )}
        {kind === 'quote' && <Field label="Quote"><Textarea rows={3} className="prose-journal text-[1.15rem]" value={f.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === 'quote' ? 'Short title (optional)' : 'Title'}><Input value={f.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Author or creator"><Input value={f.author ?? ''} onChange={(e) => set({ author: e.target.value })} /></Field>
          {kind !== 'quote' && kind !== 'note' && <Field label="Type"><Select value={f.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}><option value="">Detect automatically</option>{RESOURCE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>}
          <Field label="Category"><Select value={f.category} onChange={(e) => set({ category: e.target.value })}>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        </div>
        {kind !== 'quote' && <Field label="Description"><Textarea rows={2} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>}
        {kind !== 'quote' && <Field label={kind === 'note' ? 'Note' : 'Transcript or text (optional)'} hint={kind === 'note' ? undefined : 'Anything typed here becomes searchable.'}><Textarea rows={kind === 'note' ? 8 : 4} value={f.text ?? ''} onChange={(e) => set({ text: e.target.value })} /></Field>}
        <Field label="Tags"><TagInput value={f.tags ?? []} onChange={(tags) => set({ tags })} suggestions={['self-concept', 'neville goddard', 'scripting', 'affirmations', 'confidence', 'abundance']} /></Field>
        <Field label="Personal notes"><Textarea rows={2} value={f.personal_notes ?? ''} onChange={(e) => set({ personal_notes: e.target.value })} placeholder="Why this resonated with you…" /></Field>
      </div>
    </Modal>
  )
}
