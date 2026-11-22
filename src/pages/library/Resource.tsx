import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Mic, Pencil, RefreshCw, Star, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useData, useFileUrl } from '../../lib/hooks'
import type { KnowledgePassage, KnowledgeResource } from '../../lib/types'
import { RESOURCE_CATEGORIES, RESOURCE_TYPES } from '../../data/content'
import { canExtract, extractText } from '../../lib/extract'
import { deleteResource, replacePassages } from '../../lib/knowledge'
import { aiStatus } from '../../ai'
import { bytes, cx, downloadBlob, fmt } from '../../lib/utils'
import { Badge, Button, Card, ErrorState, Field, IconButton, Input, Loading, Modal, Select, TagInput, Textarea, useAction, useFeedback } from '../../components/ui'

const STATUS_LABEL: Record<string, string> = { extracted: 'Text extracted · searchable', manual: 'Text added manually · searchable', unsupported: 'No readable text', failed: 'Text extraction failed', none: 'No text yet' }

export default function ResourcePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const target = params.get('passage')
  const nav = useNavigate()
  const res = useData(() => db.get<KnowledgeResource>('knowledge_resources', id!), [id])
  const passages = useData(() => db.list<KnowledgePassage>('knowledge_passages', { match: { resource_id: id }, order: [{ col: 'passage_index', asc: true }] }), [id])
  const [editing, setEditing] = useState<KnowledgeResource | null>(null)
  const [textOpen, setTextOpen] = useState(false)
  const [manual, setManual] = useState('')
  const [showAll, setShowAll] = useState(false)
  const { run, busy } = useAction()
  const { confirm, toast } = useFeedback()
  const targetRef = useRef<HTMLLIElement>(null)
  const r = res.data
  const file = useFileUrl('knowledge', r?.storage_path)

  useEffect(() => { if (target && passages.data) setTimeout(() => targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200) }, [target, passages.data])

  if (res.error) return <ErrorState message={res.error} onRetry={res.reload} />
  if (res.loading && !r) return <Loading />
  if (!r) return <ErrorState message="This source could not be found." />

  const save = (patch: Partial<KnowledgeResource>, msg?: string) => run(async () => res.setData(await db.update<KnowledgeResource>('knowledge_resources', r.id, patch)), msg)
  const remove = async () => {
    if (!(await confirm({ title: 'Delete this source?', body: `“${r.title}”, its stored file and its searchable text will be permanently deleted.`, confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await deleteResource(r); nav('/library') }, 'Source deleted')
  }
  const reextract = () => run(async () => {
    const blob = await db.download('knowledge', r.storage_path!)
    const ex = await extractText(new File([blob], r.file_name ?? 'file', { type: r.mime_type ?? blob.type }))
    if (ex.status === 'extracted') await replacePassages(r.id, ex.pages)
    res.setData(await db.update<KnowledgeResource>('knowledge_resources', r.id, { extraction_status: ex.status, page_count: ex.pageCount ?? r.page_count }))
    passages.reload()
    if (ex.message) toast(ex.message, 'info')
  }, 'Text re-read')
  const saveManual = () => run(async () => {
    const n = await replacePassages(r.id, manual.trim() ? [{ page: null, text: manual }] : [])
    res.setData(await db.update<KnowledgeResource>('knowledge_resources', r.id, { extraction_status: n ? 'manual' : 'none' }))
    passages.reload(); setTextOpen(false)
  }, 'Text saved and searchable')
  const download = () => run(async () => downloadBlob(await db.download('knowledge', r.storage_path!), r.file_name ?? 'file'))

  const list = passages.data ?? []
  const visible = showAll || target ? list : list.slice(0, 12)
  const isVideo = r.mime_type?.startsWith('video/')
  const isImage = r.mime_type?.startsWith('image/')
  const isAudio = r.mime_type?.startsWith('audio/')

  return (
    <div>
      <Link to="/library" className="mb-8 inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Library</Link>
      <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">{RESOURCE_TYPES.find((t) => t.key === r.type)?.label ?? r.type} · {r.category}</p>
            <Badge tone={['extracted', 'manual'].includes(r.extraction_status) ? 'sage' : 'linen'}>{STATUS_LABEL[r.extraction_status]}</Badge>
          </div>
          {r.type === 'quote' ? <h1 className="font-display text-[2.4rem] italic leading-tight">“{r.description}”</h1> : <h1 className="text-[2.6rem] leading-[1.05] sm:text-[3.2rem]">{r.title}</h1>}
          {r.author && <p className="mt-2 font-display text-xl italic text-ink-soft">{r.type === 'quote' ? '— ' : 'by '}{r.author}</p>}
          <p className="mt-3 text-[13px] text-taupe-deep">Added {fmt(r.created_at)}{r.page_count ? ` · ${r.page_count} pages` : ''}{r.file_size ? ` · ${bytes(r.file_size)}` : ''}{r.tags.length ? ' · ' + r.tags.map((t) => `#${t}`).join(' ') : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IconButton label={r.favorite ? 'Unfavorite' : 'Favorite'} onClick={() => save({ favorite: !r.favorite })}><Star className={cx('size-4', r.favorite && 'fill-blush text-blush')} /></IconButton>
          <Button size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(r)}>Edit details</Button>
          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer"><Button size="sm" icon={<ExternalLink className="size-3.5" />}>Open link</Button></a>}
          {r.storage_path && <Button size="sm" icon={<Download className="size-3.5" />} onClick={download}>Download</Button>}
          <IconButton label="Delete source" onClick={remove}><Trash2 className="size-4" /></IconButton>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {r.storage_path && (isVideo || isImage || isAudio || r.mime_type === 'application/pdf') && (
            <Card className="overflow-hidden">
              {!file.url ? <Loading label="Loading file…" /> : isVideo ? <video src={file.url} controls className="max-h-[70vh] w-full bg-ink" /> : isAudio ? <audio src={file.url} controls className="w-full p-4" /> : isImage ? <img src={file.url} alt={r.title} className="w-full" /> : (
                <div className="flex items-center justify-between p-5 text-[14px]"><span>{r.file_name}</span><a href={file.url} target="_blank" rel="noopener noreferrer" className="underline decoration-sand underline-offset-2">Open PDF in a new tab</a></div>
              )}
            </Card>
          )}
          {r.description && r.type !== 'quote' && <p className="text-[15px] text-ink-soft whitespace-pre-wrap">{r.description}</p>}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[1.7rem]">Searchable text <span className="text-taupe-deep">· {list.length} passages</span></h2>
              <div className="flex gap-2">
                {r.storage_path && r.file_name && canExtract(new File([], r.file_name, { type: r.mime_type ?? '' })) && <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} loading={busy} onClick={reextract}>Re-read file</Button>}
                <Button size="sm" onClick={() => { setManual(list.map((p) => p.content).join('\n\n')); setTextOpen(true) }}>{list.length ? 'Edit text' : 'Add text or transcript'}</Button>
              </div>
            </div>
            {passages.loading && !passages.data ? <Loading /> : !list.length ? (
              <Card className="p-6 text-[14px] text-ink-soft">
                {r.extraction_status === 'unsupported' ? 'Becoming couldn’t find selectable text in this file. ' : ''}Add the text, a transcript or key ideas so this source can be searched — and later cited by your coach.
              </Card>
            ) : (
              <ol className="space-y-2">
                {visible.map((p) => (
                  <li key={p.id} ref={p.id === target ? targetRef : undefined} className={cx('rounded-2xl border px-5 py-4 text-[14.5px] leading-relaxed', p.id === target ? 'border-blush bg-blush-50' : 'border-beige/60 bg-white/60')}>
                    <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-taupe-deep">{p.page_number ? `Page ${p.page_number}` : `Passage ${p.passage_index + 1}`}</p>
                    <p className="whitespace-pre-wrap">{p.content}</p>
                  </li>
                ))}
              </ol>
            )}
            {!showAll && !target && list.length > 12 && <Button variant="ghost" className="mt-3" onClick={() => setShowAll(true)}>Show all {list.length} passages</Button>}
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="p-6">
            <p className="eyebrow mb-2">My notes</p>
            <NotesEditor value={r.personal_notes ?? ''} onSave={(personal_notes) => save({ personal_notes }, 'Notes saved')} />
          </Card>
          {(isVideo || isAudio || r.type === 'tiktok') && (
            <Card className="p-6 text-[13.5px]">
              <div className="mb-2 flex items-center gap-2"><Mic className="size-4 text-taupe-deep" /><p className="font-medium">Transcription</p></div>
              <p className="text-ink-soft">{aiStatus.transcription ? 'Transcribe this file with your connected service.' : r.type === 'tiktok' ? 'TikTok videos can’t be accessed or transcribed automatically. Paste the transcript using “Add text or transcript”.' : 'Automatic transcription needs a transcription service, which isn’t connected. You can paste a transcript manually.'}</p>
              <Button size="sm" className="mt-3" disabled>Transcribe automatically</Button>
            </Card>
          )}
          <Card className="p-6 text-[13.5px] text-ink-soft">
            <p className="mb-1 font-medium text-ink">How this is used</p>
            This source belongs to your Knowledge Library, kept separate from memories about you. The coach and “Ask my library” retrieve these passages and cite them with page numbers.
            <Link to={`/library/ask`} className="mt-3 block underline decoration-sand underline-offset-2">Search with Ask my library →</Link>
          </Card>
        </aside>
      </div>

      <Modal open={textOpen} onClose={() => setTextOpen(false)} title="Text, transcript or key ideas" wide footer={<><Button variant="ghost" onClick={() => setTextOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={saveManual}>Save</Button></>}>
        <p className="mb-3 text-[13px] text-ink-soft">This replaces the searchable text for this source. Separate paragraphs with a blank line.</p>
        <Textarea rows={16} value={manual} onChange={(e) => setManual(e.target.value)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit details" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => { const e = editing!; save({ title: e.title, author: e.author, type: e.type, category: e.category, description: e.description, tags: e.tags, url: e.url }, 'Saved'); setEditing(null) }}>Save</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Title"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Author or creator"><Input value={editing.author ?? ''} onChange={(e) => setEditing({ ...editing, author: e.target.value })} /></Field>
              <Field label="Type"><Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>{RESOURCE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>
              <Field label="Category"><Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
              <Field label="Link"><Input value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value || null })} /></Field>
            </div>
            <Field label={editing.type === 'quote' ? 'Quote' : 'Description'}><Textarea rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Tags"><TagInput value={editing.tags} onChange={(tags) => setEditing({ ...editing, tags })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

function NotesEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <div>
      <Textarea rows={6} value={v} onChange={(e) => setV(e.target.value)} placeholder="What you took from this…" />
      {v !== value && <Button size="sm" variant="primary" className="mt-2" onClick={() => onSave(v)}>Save notes</Button>}
    </div>
  )
}
