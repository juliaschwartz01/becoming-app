import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Lightbulb, Paperclip, Star, Trash2, X } from 'lucide-react'
import { db, uuid } from '../../lib/db'
import { requireUserId } from '../../lib/auth'
import { cachedUrl, useAutosave, useData } from '../../lib/hooks'
import type { Attachment, Goal, JournalEntry, LifeChapter, MoodEntry } from '../../lib/types'
import { JOURNAL_PROMPTS, MOODS, REFLECTION_PROMPTS } from '../../data/content'
import { bytes, cx, fmt, safeFileName, today } from '../../lib/utils'
import { Button, ErrorState, Field, IconButton, Loading, SaveStatus, Select, Spinner, TagInput, useAction, useFeedback } from '../../components/ui'

type Draft = Pick<JournalEntry, 'title' | 'body' | 'prompt' | 'entry_date' | 'tags' | 'favorite' | 'chapter_id' | 'goal_id' | 'attachments'>

export default function JournalEntryPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const isNew = id === 'new'
  const [entryId, setEntryId] = useState<string | null>(isNew ? null : id!)
  const [draft, setDraft] = useState<Draft | null>(isNew ? {
    title: '', body: '', prompt: params.get('prompt'), entry_date: params.get('date') || today(), tags: [], favorite: false, chapter_id: null, goal_id: null, attachments: [],
  } : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showPrompts, setShowPrompts] = useState(false)
  const creating = useRef<Promise<string> | null>(null)
  const { confirm, toast } = useFeedback()
  const { run } = useAction()
  const chapters = useData(() => db.list<LifeChapter>('life_chapters', { order: [{ col: 'created_at' }] }), [])
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' } }), [])
  const moods = useData(() => entryId ? db.list<MoodEntry>('mood_entries', { match: { journal_entry_id: entryId }, order: [{ col: 'recorded_at' }] }) : Promise.resolve([]), [entryId])

  useEffect(() => {
    if (isNew || (draft && id === entryId)) return
    db.get<JournalEntry>('journal_entries', id!).then((e) => {
      if (!e) { setLoadError('This entry could not be found.'); return }
      setDraft({ title: e.title ?? '', body: e.body, prompt: e.prompt, entry_date: e.entry_date, tags: e.tags ?? [], favorite: e.favorite, chapter_id: e.chapter_id, goal_id: e.goal_id, attachments: e.attachments ?? [] })
    }).catch((e) => setLoadError(e.message))
  }, [id, isNew])

  const ensureId = async (d: Draft): Promise<string> => {
    if (entryId) return entryId
    if (!creating.current) {
      creating.current = db.insert<JournalEntry>('journal_entries', d).then((row) => {
        setEntryId(row.id)
        nav(`/inner-world/journal/${row.id}`, { replace: true })
        return row.id
      })
    }
    return creating.current
  }

  const autosave = useAutosave(draft, async (d) => {
    if (!d) return
    if (!entryId && !creating.current) {
      if (!d.title?.trim() && !d.body.trim()) return
      await ensureId(d)
      return
    }
    const eid = await ensureId(d)
    await db.update('journal_entries', eid, d)
  }, { delay: 1000, enabled: draft !== null })

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d))

  const remove = async () => {
    if (!entryId) { nav('/inner-world/journal'); return }
    if (!(await confirm({ title: 'Delete this entry?', body: 'This journal entry and its attachments will be permanently deleted. This can’t be undone.', confirmLabel: 'Delete entry', danger: true }))) return
    await run(async () => {
      const paths = (draft?.attachments ?? []).map((a) => a.path)
      if (paths.length) await db.removeFiles('attachments', paths)
      await db.remove('journal_entries', entryId)
      nav('/inner-world/journal')
    }, 'Entry deleted')
  }

  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const upload = async (files: FileList | null) => {
    if (!files?.length || !draft) return
    setUploading(true)
    try {
      const eid = await ensureId(draft)
      const added: Attachment[] = []
      for (const f of Array.from(files)) {
        if (f.size > 20 * 1024 * 1024) { toast(`${f.name} is larger than 20 MB`, 'error'); continue }
        const path = `${requireUserId()}/journal/${eid}/${uuid().slice(0, 8)}-${safeFileName(f.name)}`
        await db.upload('attachments', path, f, f.type)
        added.push({ path, name: f.name, type: f.type, size: f.size })
      }
      const next = [...draft.attachments, ...added]
      await db.update('journal_entries', eid, { attachments: next })
      set({ attachments: next })
      if (added.length) toast(`${added.length} attachment${added.length > 1 ? 's' : ''} saved`)
    } catch (e) { toast((e as Error).message, 'error') }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = '' }
  }
  const removeAttachment = async (a: Attachment) => {
    if (!entryId || !draft) return
    if (!(await confirm({ title: 'Remove attachment?', body: `“${a.name}” will be permanently deleted.`, confirmLabel: 'Remove', danger: true }))) return
    run(async () => {
      await db.removeFiles('attachments', [a.path])
      const next = draft.attachments.filter((x) => x.path !== a.path)
      await db.update('journal_entries', entryId, { attachments: next })
      set({ attachments: next })
    }, 'Attachment removed')
  }
  const openAttachment = (a: Attachment) => run(async () => { window.open(await cachedUrl('attachments', a.path), '_blank', 'noopener') })

  const addMood = (value: number) => run(async () => {
    if (!draft) return
    const eid = await ensureId(draft)
    const m = MOODS.find((x) => x.value === value)!
    const row = await db.insert<MoodEntry>('mood_entries', { mood: value, label: m.label, journal_entry_id: eid, recorded_at: new Date().toISOString() })
    moods.setData((l) => [row, ...(l ?? [])])
  }, 'Mood linked to this entry')

  if (loadError) return <ErrorState message={loadError} />
  if (!draft) return <Loading />

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link to="/inner-world/journal" className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Journal</Link>
        <div className="flex items-center gap-2">
          <SaveStatus state={autosave.state} error={autosave.error} />
          <IconButton label={draft.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => set({ favorite: !draft.favorite })}>
            <Star className={cx('size-4', draft.favorite && 'fill-blush text-blush')} />
          </IconButton>
          <IconButton label="Delete entry" onClick={remove}><Trash2 className="size-4" /></IconButton>
        </div>
      </div>

      <div className="animate-rise">
        <input type="date" value={draft.entry_date} onChange={(e) => set({ entry_date: e.target.value || today() })} className="eyebrow bg-transparent outline-none" aria-label="Entry date" />
        <p className="sr-only">{fmt(draft.entry_date, 'EEEE, MMMM d, yyyy')}</p>
        <input value={draft.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Title" className="mt-3 w-full bg-transparent font-display text-[2.6rem] leading-tight outline-none placeholder:text-sand sm:text-[3.2rem]" />

        {draft.prompt ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-sage-deep" />
            <p className="flex-1 font-display text-[1.2rem] italic">{draft.prompt}</p>
            <IconButton label="Remove prompt" className="size-7" onClick={() => set({ prompt: null })}><X className="size-3.5" /></IconButton>
          </div>
        ) : (
          <button onClick={() => setShowPrompts(!showPrompts)} className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink cursor-pointer"><Lightbulb className="size-3.5" /> Use a guided prompt</button>
        )}
        {showPrompts && !draft.prompt && (
          <div className="mt-3 flex flex-wrap gap-2 animate-rise">
            {[...JOURNAL_PROMPTS, ...REFLECTION_PROMPTS.slice(0, 6)].map((p) => (
              <button key={p} onClick={() => { set({ prompt: p }); setShowPrompts(false) }} className="rounded-full border border-beige bg-white/70 px-3 py-1.5 text-[13px] text-ink-soft hover:border-sand hover:text-ink cursor-pointer">{p}</button>
            ))}
          </div>
        )}

        <textarea
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          placeholder="Begin anywhere…"
          className="prose-journal mt-6 min-h-[50vh] w-full resize-none bg-transparent outline-none placeholder:text-sand"
          autoFocus={isNew}
        />
      </div>

      <div className="mt-8 space-y-6 rounded-3xl border border-beige/70 bg-white/50 p-6">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">How I felt</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {MOODS.map((m) => <button key={m.value} onClick={() => addMood(m.value)} className="rounded-full px-3 py-1 text-[13px] transition hover:-translate-y-0.5 cursor-pointer" style={{ background: m.tone }}>{m.label}</button>)}
          </div>
          {(moods.data ?? []).length > 0 && <p className="mt-2 text-[12.5px] text-taupe-deep">Linked check-ins: {moods.data!.map((m) => `${m.label} (${fmt(m.recorded_at, 'MMM d, h:mm a')})`).join(' · ')}</p>}
        </div>
        <Field label="Tags"><TagInput value={draft.tags} onChange={(tags) => set({ tags })} suggestions={['gratitude', 'growth', 'relationships', 'career', 'manifestation', 'dreams', 'anxiety', 'wins']} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Life chapter">
            <Select value={draft.chapter_id ?? ''} onChange={(e) => set({ chapter_id: e.target.value || null })}>
              <option value="">None</option>{(chapters.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
          <Field label="Related goal">
            <Select value={draft.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}>
              <option value="">None</option>{(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">Attachments</p>
          <ul className="mb-3 space-y-1.5">
            {draft.attachments.map((a) => (
              <li key={a.path} className="flex items-center gap-2 rounded-xl bg-linen/60 px-3 py-2 text-[13.5px]">
                <Paperclip className="size-3.5 text-taupe-deep" />
                <button onClick={() => openAttachment(a)} className="flex-1 truncate text-left hover:underline cursor-pointer">{a.name}</button>
                <span className="text-[12px] text-taupe-deep">{bytes(a.size)}</span>
                <IconButton label="Remove attachment" className="size-7" onClick={() => removeAttachment(a)}><X className="size-3.5" /></IconButton>
              </li>
            ))}
          </ul>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" variant="secondary" icon={uploading ? <Spinner className="size-3.5" /> : <Paperclip className="size-3.5" />} disabled={uploading} onClick={() => fileInput.current?.click()}>Attach files</Button>
          <p className="mt-2 text-[12px] text-taupe-deep">Stored privately in your Supabase “attachments” bucket. Up to 20 MB each.</p>
        </div>
      </div>
    </div>
  )
}
