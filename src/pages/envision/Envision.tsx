import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, FolderInput, ImagePlus, Plus, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { db } from '../../lib/db'
import { useData, useFileUrl } from '../../lib/hooks'
import type { BoardElement, VisionBoard, VisionImage } from '../../lib/types'
import { CATEGORIES, categoryLabel } from '../../data/content'
import { aiStatus, generateImages } from '../../ai'
import { dataUrlToBlob, deleteVisionImage, saveVisionImage } from '../../lib/images'
import { cx, downloadBlob, fmt, safeFileName } from '../../lib/utils'
import { Button, Card, Chip, EmptyState, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, SectionTitle, Select, Spinner, Textarea, useAction, useFeedback } from '../../components/ui'

export default function Envision() {
  const nav = useNavigate()
  const boards = useData(() => db.list<VisionBoard>('vision_boards', { order: [{ col: 'updated_at' }] }), [])
  const elements = useData(() => db.list<BoardElement>('vision_board_elements', { select: 'id,board_id,type,x,y,w,h,rotation,z,content,image_id,style' }), [])
  const images = useData(() => db.list<VisionImage>('vision_images', { order: [{ col: 'created_at' }] }), [])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('lifestyle')
  const { run, busy } = useAction()

  const create = () => run(async () => {
    const b = await db.insert<VisionBoard>('vision_boards', { title: title.trim() || 'Untitled board', category })
    nav(`/envision/board/${b.id}`)
  }, 'Board created')

  return (
    <>
      <PageHeader eyebrow="Envision" title="Vision Board Studio" intro="Describe the life you’re calling in, gather images that feel like it, and arrange them into boards you love to look at."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New board</Button>} />

      <section>
        <SectionTitle>My boards</SectionTitle>
        {boards.error && <ErrorState message={boards.error} onRetry={boards.reload} />}
        {boards.loading && !boards.data ? <Loading /> : !boards.data?.length ? (
          <EmptyState title="Your first board" body="Start with a feeling or a place — “My New York era”, “Soft mornings”, “Creative career” — and build from there." action={<Button variant="primary" onClick={() => setCreating(true)}>Create a board</Button>} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {boards.data.map((b) => <BoardCard key={b.id} board={b} elements={(elements.data ?? []).filter((e) => e.board_id === b.id)} images={images.data ?? []} />)}
          </div>
        )}
      </section>

      <ImageCollection images={images} boards={boards.data ?? []} />
      <GenerationPanel onSaved={(img) => images.setData((l) => [img, ...(l ?? [])])} />

      <Modal open={creating} onClose={() => setCreating(false)} title="New vision board" footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={create}>Create</Button></>}>
        <div className="space-y-4">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My New York Era" /></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        </div>
      </Modal>
    </>
  )
}

function BoardCard({ board, elements, images }: { board: VisionBoard; elements: BoardElement[]; images: VisionImage[] }) {
  return (
    <Link to={`/envision/board/${board.id}`} className="group">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl shadow-soft transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift" style={{ background: board.background }}>
        {elements.sort((a, b) => a.z - b.z).map((e) => (
          <div key={e.id} className="absolute overflow-hidden" style={{ left: `${(e.x / board.width) * 100}%`, top: `${(e.y / board.height) * 100}%`, width: `${(e.w / board.width) * 100}%`, height: `${(e.h / board.height) * 100}%`, transform: `rotate(${e.rotation}deg)` }}>
            {e.type === 'image' ? <Thumb path={images.find((i) => i.id === e.image_id)?.storage_path} /> : (
              <div className="flex h-full items-center justify-center p-1 text-center font-display italic leading-tight text-ink" style={{ fontSize: `${Math.max(6, ((e.style?.fontSize ?? 40) / board.width) * 340)}px`, color: e.style?.color }}>{e.content}</div>
            )}
          </div>
        ))}
        {!elements.length && <div className="absolute inset-0 flex items-center justify-center font-display text-xl italic text-taupe-deep">Empty canvas</div>}
      </div>
      <div className="mt-3 px-1">
        <p className="font-display text-[1.35rem] leading-tight">{board.title}</p>
        <p className="text-[12px] text-taupe-deep">{categoryLabel(board.category)} · updated {fmt(board.updated_at, 'MMM d')}</p>
      </div>
    </Link>
  )
}

export function Thumb({ path, className }: { path?: string | null; className?: string }) {
  const { url, failed } = useFileUrl('vision-images', path)
  if (failed) return <div className={cx('flex h-full w-full items-center justify-center bg-linen text-[10px] text-taupe-deep', className)}>unavailable</div>
  if (!url) return <div className={cx('h-full w-full animate-pulse bg-linen', className)} />
  return <img src={url} alt="" draggable={false} className={cx('h-full w-full object-cover', className)} />
}

function ImageCollection({ images, boards }: { images: ReturnType<typeof useData<VisionImage[]>>; boards: VisionBoard[] }) {
  const [cat, setCat] = useState<string | null>(null)
  const [uploadCat, setUploadCat] = useState('lifestyle')
  const [uploading, setUploading] = useState(false)
  const [moving, setMoving] = useState<VisionImage | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const { toast, confirm } = useFeedback()
  const { run } = useAction()
  const items = (images.data ?? []).filter((i) => !cat || i.category === cat)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    let n = 0
    for (const f of Array.from(files)) {
      try { const img = await saveVisionImage(f, { name: f.name, category: uploadCat, title: f.name.replace(/\.[^.]+$/, '') }); images.setData((l) => [img, ...(l ?? [])]); n++ }
      catch (e) { toast(`${f.name}: ${(e as Error).message}`, 'error') }
    }
    setUploading(false)
    if (input.current) input.current.value = ''
    if (n) toast(`${n} image${n > 1 ? 's' : ''} saved to your private collection`)
  }
  const remove = async (img: VisionImage) => {
    if (!(await confirm({ title: 'Delete this image?', body: 'It will be permanently deleted from your private storage and removed from any boards using it.', confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await deleteVisionImage(img); images.setData((l) => l?.filter((x) => x.id !== img.id)) }, 'Image deleted')
  }
  const download = (img: VisionImage) => run(async () => {
    const blob = await db.download('vision-images', img.storage_path)
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
    await downloadBlob(blob, `${safeFileName(img.title || 'vision-image')}.${ext}`.replace(/\.[a-z0-9]+\.([a-z0-9]+)$/, '.$1'))
  })

  return (
    <section className="mt-16">
      <SectionTitle action={
        <div className="flex items-center gap-2">
          <Select className="h-9 w-auto text-[13px]" value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} aria-label="Category for uploads">{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" icon={uploading ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />} disabled={uploading} onClick={() => input.current?.click()}>Upload images</Button>
        </div>
      }>My image collection</SectionTitle>
      <p className="-mt-2 mb-4 text-[13px] text-ink-soft">Images you choose to keep, stored in a private bucket only you can open.</p>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
        {CATEGORIES.map((c) => <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>)}
      </div>
      {images.error && <ErrorState message={images.error} onRetry={images.reload} />}
      {images.loading && !images.data ? <Loading /> : !items.length ? (
        <EmptyState icon={<ImagePlus className="size-7" strokeWidth={1.2} />} title="No images yet" body="Upload photographs that feel like the life you want — places, interiors, moods, outfits." />
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {items.map((img) => (
            <figure key={img.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-linen shadow-soft">
              <div style={{ aspectRatio: img.width && img.height ? `${img.width}/${img.height}` : '1' }}><Thumb path={img.storage_path} /></div>
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-ink/55 to-transparent p-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <span className="truncate text-[11.5px] text-white">{categoryLabel(img.category)}{img.source === 'generated' ? ' · AI' : ''}</span>
                <span className="flex gap-0.5">
                  <IconButton label="Move or recategorize" className="size-7 text-white hover:bg-white/20 hover:text-white" onClick={() => setMoving(img)}><FolderInput className="size-3.5" /></IconButton>
                  <IconButton label="Download" className="size-7 text-white hover:bg-white/20 hover:text-white" onClick={() => download(img)}><Download className="size-3.5" /></IconButton>
                  <IconButton label="Delete" className="size-7 text-white hover:bg-white/20 hover:text-white" onClick={() => remove(img)}><Trash2 className="size-3.5" /></IconButton>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <MoveModal img={moving} boards={boards} onClose={() => setMoving(null)} onSaved={(row) => { images.setData((l) => l?.map((x) => (x.id === row.id ? row : x))); setMoving(null) }} />
    </section>
  )
}

function MoveModal({ img, boards, onClose, onSaved }: { img: VisionImage | null; boards: VisionBoard[]; onClose: () => void; onSaved: (i: VisionImage) => void }) {
  const [category, setCategory] = useState('lifestyle')
  const [boardId, setBoardId] = useState('')
  const [addToBoard, setAddToBoard] = useState(true)
  const { run, busy } = useAction()
  useEffect(() => { if (img) { setCategory(img.category); setBoardId(img.board_id ?? '') } }, [img])
  const save = () => run(async () => {
    if (!img) return
    const row = await db.update<VisionImage>('vision_images', img.id, { category, board_id: boardId || null })
    if (boardId && boardId !== img.board_id) {
      // Move: remove it from the previous board's canvas, then place it on the new one.
      if (img.board_id) await db.removeWhere('vision_board_elements', { board_id: img.board_id, image_id: img.id })
      if (addToBoard) {
        const ratio = img.width && img.height ? img.height / img.width : 1
        await db.insert('vision_board_elements', { board_id: boardId, type: 'image', image_id: img.id, x: 80, y: 80, w: 420, h: 420 * ratio, z: Date.now() % 100000, style: {} })
      }
    }
    onSaved(row)
  }, 'Image updated')
  return (
    <Modal open={!!img} onClose={onClose} title="Organize image" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        <Field label="Board" hint="Moving an image takes it off its previous board’s canvas."><Select value={boardId} onChange={(e) => setBoardId(e.target.value)}><option value="">Not on a board</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</Select></Field>
        {boardId && boardId !== img?.board_id && <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={addToBoard} onChange={(e) => setAddToBoard(e.target.checked)} /> Place it on that board’s canvas</label>}
      </div>
    </Modal>
  )
}

/**
 * AI image generation (switched off until a provider is approved).
 * Reference photos of you live ONLY in this component's memory: they are never
 * uploaded to storage, never written to the database, and are cleared after use.
 */
function GenerationPanel({ onSaved }: { onSaved: (img: VisionImage) => void }) {
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState('future-self')
  const [refs, setRefs] = useState<{ file: File; url: string }[]>([])
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const { run } = useAction()

  const clearRefs = () => setRefs((r) => { r.forEach((x) => URL.revokeObjectURL(x.url)); return [] })
  useEffect(() => () => { refs.forEach((x) => URL.revokeObjectURL(x.url)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async () => {
    setBusy(true); setError(null)
    try {
      const out = await generateImages({ prompt, referencePhotos: refs.map((r) => r.file) })
      setResults(out.images.map((i) => i.dataUrl))
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false); clearRefs() } // reference photos are discarded after the request
  }
  const keep = (dataUrl: string) => run(async () => {
    onSaved(await saveVisionImage(dataUrlToBlob(dataUrl), { category, source: 'generated', prompt, title: prompt.slice(0, 60) }))
    setResults((r) => r.filter((x) => x !== dataUrl))
  }, 'Saved to your collection')

  return (
    <section className="mt-16">
      <SectionTitle>Generate visualizations</SectionTitle>
      <Card className="p-6 sm:p-8">
        {!aiStatus.image && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-blush-100 bg-blush-50/70 p-4 text-[13.5px]">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-blush-deep" />
            <div><p className="font-medium">Image generation isn’t connected</p><p className="text-ink-soft">Becoming can’t create photorealistic images without a real image-generation model, so this panel is switched off. The board editor, uploads and your collection all work fully today.</p></div>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <Field label="Describe the image"><Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={!aiStatus.image} placeholder="Me walking through the West Village in autumn, coffee in hand, feeling confident…" /></Field>
            <Field label="Save kept images to"><Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!aiStatus.image}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
            <Button variant="primary" loading={busy} disabled={!aiStatus.image || !prompt.trim()} icon={<Sparkles className="size-4" />} onClick={generate}>Generate</Button>
            {error && <ErrorState message={error} />}
          </div>
          <div className="rounded-2xl bg-linen/60 p-5">
            <div className="mb-2 flex items-center gap-2"><ShieldCheck className="size-4 text-sage-deep" /><p className="text-[14px] font-medium">Temporary reference photos</p></div>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-[12.5px] text-ink-soft">
              <li>Selected from your device and kept only in this browser tab’s memory</li>
              <li>Never saved to Supabase, the Knowledge Library or GitHub</li>
              <li>Sent only with the single generation request you start</li>
              <li>Discarded right after processing, or when you leave this page</li>
            </ul>
            <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 4)
              setRefs((r) => [...r, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 4))
              e.target.value = ''
            }} />
            <div className="flex flex-wrap gap-2">
              {refs.map((r) => (
                <div key={r.url} className="relative size-16 overflow-hidden rounded-xl">
                  <img src={r.url} alt="Temporary reference" className="h-full w-full object-cover" />
                  <button aria-label="Discard photo" onClick={() => { URL.revokeObjectURL(r.url); setRefs((x) => x.filter((y) => y.url !== r.url)) }} className="absolute right-0.5 top-0.5 rounded-full bg-ink/60 p-0.5 text-white cursor-pointer"><X className="size-3" /></button>
                </div>
              ))}
              <Button size="sm" disabled={!aiStatus.image || refs.length >= 4} onClick={() => input.current?.click()}>Choose photos</Button>
              {refs.length > 0 && <Button size="sm" variant="ghost" onClick={clearRefs}>Discard all</Button>}
            </div>
            {!aiStatus.image && <p className="mt-3 text-[11.5px] text-taupe-deep">Disabled until an image model is connected — there’s nothing to send photos to yet. Before enabling one, its own processing and retention policy will be explained separately.</p>}
          </div>
        </div>
        {results.length > 0 && (
          <div className="mt-8">
            <p className="eyebrow mb-3">Results — only the ones you keep are saved</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {results.map((r) => (
                <div key={r} className="overflow-hidden rounded-2xl bg-linen">
                  <img src={r} alt="Generated visualization" className="aspect-square w-full object-cover" />
                  <div className="flex gap-1 p-2"><Button size="sm" variant="primary" className="flex-1" onClick={() => keep(r)}>Keep</Button><Button size="sm" variant="ghost" onClick={() => setResults((x) => x.filter((y) => y !== r))}>Discard</Button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

