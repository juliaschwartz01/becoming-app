import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, BringToFront, Copy, Download, Image as ImageIcon, Italic, LayoutGrid, MessageSquareQuote,
  Palette, SendToBack, Settings2, Sparkles, Trash2, Type, Upload,
} from 'lucide-react'
import { db } from '../../lib/db'
import { cachedUrl, useAutosave, useData } from '../../lib/hooks'
import { useProfile } from '../../lib/profile'
import type { BoardElement, Goal, LifeChapter, ManifestationPlan, Vision, VisionBoard, VisionImage } from '../../lib/types'
import { BOARD_BACKGROUNDS, TEXT_DEFAULTS, arrange, renderBoardPng } from '../../lib/board'
import { saveVisionImage } from '../../lib/images'
import { CATEGORIES, DEFAULT_AFFIRMATIONS } from '../../data/content'
import { aiStatus, visionToPrompt } from '../../ai'
import { cx, downloadBlob, fmt, safeFileName } from '../../lib/utils'
import { Button, Card, Chip, ErrorState, Field, IconButton, Input, Loading, Modal, SaveStatus, Select, Spinner, Textarea, useAction, useFeedback } from '../../components/ui'
import { Thumb } from './Envision'

type El = BoardElement
const EDITABLE: (keyof El)[] = ['x', 'y', 'w', 'h', 'rotation', 'z', 'content', 'style']
const snapshot = (e: El) => JSON.stringify(EDITABLE.map((k) => e[k]))

export default function BoardEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const { prefs } = useProfile()
  const { toast, confirm } = useFeedback()
  const { run } = useAction()

  const board = useData(() => db.get<VisionBoard>('vision_boards', id!), [id])
  const images = useData(() => db.list<VisionImage>('vision_images', { order: [{ col: 'created_at' }] }), [])
  const [els, setEls] = useState<El[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const saved = useRef(new Map<string, string>())
  const [selected, setSelected] = useState<string | null>(null)
  const [panel, setPanel] = useState<'vision' | 'design' | null>('vision')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [affirmOpen, setAffirmOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    db.list<El>('vision_board_elements', { match: { board_id: id }, order: [{ col: 'z', asc: true }] })
      .then((rows) => { rows.forEach((r) => saved.current.set(r.id, snapshot(r))); setEls(rows) })
      .catch((e) => setLoadErr(e.message))
  }, [id])

  // Autosave changed elements (position, size, text, style).
  const autosave = useAutosave(els, async (list) => {
    if (!list) return
    for (const e of list) {
      const snap = snapshot(e)
      if (saved.current.get(e.id) === snap) continue
      const patch: Partial<El> = {}
      for (const k of EDITABLE) (patch as any)[k] = e[k]
      await db.update('vision_board_elements', e.id, patch)
      saved.current.set(e.id, snap)
    }
    await db.update('vision_boards', id!, { updated_at: new Date().toISOString() } as Partial<VisionBoard>)
  }, { delay: 800, enabled: els !== null })

  const imagePath = useCallback((imageId: string | null) => images.data?.find((i) => i.id === imageId)?.storage_path ?? null, [images.data])
  const maxZ = () => Math.max(0, ...(els ?? []).map((e) => e.z))
  const update = (eid: string, patch: Partial<El>) => setEls((l) => l?.map((e) => (e.id === eid ? { ...e, ...patch, style: patch.style ? { ...e.style, ...patch.style } : e.style } : e)) ?? null)

  const addElement = async (partial: Partial<El>) => {
    const b = board.data!
    const row = await db.insert<El>('vision_board_elements', { board_id: b.id, x: b.width / 2 - (partial.w ?? 400) / 2, y: b.height / 2 - (partial.h ?? 300) / 2, rotation: 0, z: maxZ() + 1, style: {}, ...partial })
    saved.current.set(row.id, snapshot(row))
    setEls((l) => [...(l ?? []), row])
    setSelected(row.id)
  }
  const addImage = (img: VisionImage) => run(async () => {
    const ratio = img.width && img.height ? img.height / img.width : 1
    const w = 440
    await addElement({ type: 'image', image_id: img.id, w, h: w * ratio })
    if (!img.board_id) await db.update('vision_images', img.id, { board_id: board.data!.id })
  })
  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const img = await saveVisionImage(f, { name: f.name, category: board.data!.category, board_id: board.data!.id, title: f.name.replace(/\.[^.]+$/, '') })
        images.setData((l) => [img, ...(l ?? [])])
        const ratio = img.width && img.height ? img.height / img.width : 1
        await addElement({ type: 'image', image_id: img.id, w: 440, h: 440 * ratio })
      }
      toast('Image saved and placed on your board')
    } catch (e) { toast((e as Error).message, 'error') }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = '' }
  }
  const addText = (type: 'text' | 'affirmation', content: string) => run(() => addElement({ type, content, w: type === 'text' ? 620 : 560, h: type === 'text' ? 120 : 150, style: { ...TEXT_DEFAULTS[type] } }))
  const removeSelected = () => {
    if (!selected) return
    const sid = selected
    run(async () => { await db.remove('vision_board_elements', sid); saved.current.delete(sid); setEls((l) => l?.filter((e) => e.id !== sid) ?? null); setSelected(null) })
  }
  const duplicate = () => {
    const e = els?.find((x) => x.id === selected)
    if (!e) return
    const { id: _id, created_at: _c, updated_at: _u, user_id: _uid, ...rest } = e
    void _id; void _c; void _u; void _uid
    run(() => addElement({ ...rest, x: e.x + 40, y: e.y + 40, z: maxZ() + 1 }))
  }
  const layer = (dir: 1 | -1) => {
    if (!selected || !els) return
    const z = dir === 1 ? maxZ() + 1 : Math.min(...els.map((e) => e.z)) - 1
    update(selected, { z })
  }
  const applyLayout = (kind: 'grid' | 'collage' | 'center') => {
    if (!els?.length || !board.data) return
    const pos = arrange(els, kind, board.data.width, board.data.height)
    setEls(els.map((e) => (pos[e.id] ? { ...e, ...pos[e.id] } : e)))
  }
  const setBackground = (background: string) => run(async () => { board.setData(await db.update<VisionBoard>('vision_boards', id!, { background })) })

  const exportPng = async () => {
    if (!board.data || !els) return
    setExporting(true)
    try {
      await autosave.flush()
      const blob = await renderBoardPng(board.data, els, async (imageId) => cachedUrl('vision-images', imagePath(imageId)!))
      downloadBlob(blob, `${safeFileName(board.data.title)}.png`)
      toast('Board exported as PNG')
    } catch (e) { toast((e as Error).message, 'error') }
    finally { setExporting(false) }
  }
  const deleteBoard = async () => {
    if (!(await confirm({ title: 'Delete this board?', body: 'The board layout and its text will be deleted. Images stay in your collection.', confirmLabel: 'Delete board', danger: true }))) return
    run(async () => { await db.remove('vision_boards', id!); nav('/envision') }, 'Board deleted')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected() }
      if (e.key === 'Escape') setSelected(null)
      const step = e.shiftKey ? 20 : 4
      const el = els?.find((x) => x.id === selected)
      if (!el) return
      if (e.key === 'ArrowLeft') update(selected, { x: el.x - step })
      if (e.key === 'ArrowRight') update(selected, { x: el.x + step })
      if (e.key === 'ArrowUp') { e.preventDefault(); update(selected, { y: el.y - step }) }
      if (e.key === 'ArrowDown') { e.preventDefault(); update(selected, { y: el.y + step }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (board.error || loadErr) return <ErrorState message={board.error || loadErr!} onRetry={board.reload} />
  if (!board.data || !els) return <Loading label="Opening your board…" />
  const b = board.data
  const sel = els.find((e) => e.id === selected) ?? null
  const affirmations = prefs?.affirmations?.length ? prefs.affirmations : DEFAULT_AFFIRMATIONS

  return (
    <div className="-mx-2 sm:mx-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-2 sm:px-0">
        <div className="flex items-center gap-3">
          <Link to="/envision" aria-label="Back to Envision" className="flex size-9 items-center justify-center rounded-full hover:bg-linen"><ArrowLeft className="size-4" /></Link>
          <div>
            <h1 className="text-[2rem] leading-tight">{b.title}</h1>
            <SaveStatus state={autosave.state} error={autosave.error} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={panel === 'vision' ? 'quiet' : 'ghost'} icon={<MessageSquareQuote className="size-3.5" />} onClick={() => setPanel(panel === 'vision' ? null : 'vision')}>Vision</Button>
          <Button size="sm" variant={panel === 'design' ? 'quiet' : 'ghost'} icon={<Palette className="size-3.5" />} onClick={() => setPanel(panel === 'design' ? null : 'design')}>Design</Button>
          <Button size="sm" variant="ghost" icon={<Settings2 className="size-3.5" />} onClick={() => setSettingsOpen(true)}>Board settings</Button>
          <Button size="sm" variant="primary" loading={exporting} icon={<Download className="size-3.5" />} onClick={exportPng}>Export PNG</Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-beige/70 bg-white/60 p-1.5">
        <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadImages(e.target.files)} />
        <Button size="sm" variant="ghost" icon={uploading ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />} disabled={uploading} onClick={() => fileInput.current?.click()}>From device</Button>
        <Button size="sm" variant="ghost" icon={<ImageIcon className="size-3.5" />} onClick={() => setPickerOpen(true)}>From collection</Button>
        <Button size="sm" variant="ghost" icon={<Type className="size-3.5" />} onClick={() => addText('text', 'Your words here')}>Text</Button>
        <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} onClick={() => setAffirmOpen(true)}>Affirmation</Button>
        <span className="mx-1 h-6 w-px bg-beige" />
        {sel && (
          <>
            <IconButton label="Bring to front" onClick={() => layer(1)}><BringToFront className="size-4" /></IconButton>
            <IconButton label="Send to back" onClick={() => layer(-1)}><SendToBack className="size-4" /></IconButton>
            <IconButton label="Duplicate" onClick={duplicate}><Copy className="size-4" /></IconButton>
            <IconButton label="Delete element" onClick={removeSelected}><Trash2 className="size-4" /></IconButton>
            <label className="ml-1 flex items-center gap-2 text-[12px] text-ink-soft">Rotate
              <input type="range" min={-30} max={30} value={sel.rotation} onChange={(e) => update(sel.id, { rotation: Number(e.target.value) })} className="w-20 accent-[#64725a]" />
            </label>
          </>
        )}
        {!sel && <span className="px-2 text-[12px] text-taupe-deep">Select an element to arrange it · drag to move · corner to resize · arrow keys nudge</span>}
      </div>

      <div className={cx('grid gap-4', panel ? 'xl:grid-cols-[1fr_340px]' : '')}>
        <Canvas board={b} els={els} selected={selected} onSelect={setSelected} onChange={update} imagePath={imagePath} />
        {panel === 'vision' && <VisionPanel board={b} />}
        {panel === 'design' && (
          <Card className="h-fit space-y-6 p-5">
            <div>
              <p className="eyebrow mb-2">Background</p>
              <div className="flex flex-wrap gap-2">
                {BOARD_BACKGROUNDS.map((c) => <button key={c} aria-label={`Background ${c}`} onClick={() => setBackground(c)} className={cx('size-9 rounded-full border cursor-pointer', b.background === c ? 'ring-2 ring-ink ring-offset-2' : 'border-beige')} style={{ background: c }} />)}
                <label className="relative size-9 overflow-hidden rounded-full border border-dashed border-sand" title="Custom colour">
                  <input type="color" value={b.background} onChange={(e) => setBackground(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                  <Palette className="m-2.5 size-4 text-taupe-deep" />
                </label>
              </div>
            </div>
            <div>
              <p className="eyebrow mb-2">Layout</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<LayoutGrid className="size-3.5" />} onClick={() => applyLayout('grid')}>Grid</Button>
                <Button size="sm" onClick={() => applyLayout('collage')}>Collage</Button>
                <Button size="sm" onClick={() => applyLayout('center')}>Center text</Button>
              </div>
            </div>
            {sel && sel.type !== 'image' && (
              <div className="space-y-3 border-t border-beige/70 pt-5">
                <p className="eyebrow">Selected text</p>
                <Textarea rows={3} value={sel.content ?? ''} onChange={(e) => update(sel.id, { content: e.target.value })} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip active={(sel.style.font ?? 'display') === 'display'} onClick={() => update(sel.id, { style: { font: 'display' } })}>Serif</Chip>
                  <Chip active={sel.style.font === 'sans'} onClick={() => update(sel.id, { style: { font: 'sans' } })}>Sans</Chip>
                  <IconButton label="Italic" className={cx(sel.style.italic && 'bg-linen text-ink')} onClick={() => update(sel.id, { style: { italic: !sel.style.italic } })}><Italic className="size-4" /></IconButton>
                  <IconButton label="Align left" onClick={() => update(sel.id, { style: { align: 'left' } })}><AlignLeft className="size-4" /></IconButton>
                  <IconButton label="Align center" onClick={() => update(sel.id, { style: { align: 'center' } })}><AlignCenter className="size-4" /></IconButton>
                  <IconButton label="Align right" onClick={() => update(sel.id, { style: { align: 'right' } })}><AlignRight className="size-4" /></IconButton>
                </div>
                <label className="flex items-center gap-3 text-[13px] text-ink-soft">Size
                  <input type="range" min={18} max={160} value={sel.style.fontSize ?? 48} onChange={(e) => update(sel.id, { style: { fontSize: Number(e.target.value) } })} className="flex-1 accent-[#64725a]" />
                  <span className="w-8 text-right">{sel.style.fontSize ?? 48}</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">Colour
                  {['#3b342e', '#fbf8f3', '#64725a', '#b48678', '#85766a'].map((c) => <button key={c} aria-label={`Text colour ${c}`} onClick={() => update(sel.id, { style: { color: c } })} className={cx('size-7 rounded-full border border-beige cursor-pointer', sel.style.color === c && 'ring-2 ring-ink ring-offset-1')} style={{ background: c }} />)}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">Card
                  <Chip active={!sel.style.bg} onClick={() => update(sel.id, { style: { bg: undefined } })}>None</Chip>
                  <Chip active={sel.style.bg === 'rgba(251,248,243,0.88)'} onClick={() => update(sel.id, { style: { bg: 'rgba(251,248,243,0.88)' } })}>Ivory</Chip>
                  <Chip active={sel.style.bg === 'rgba(59,52,46,0.82)'} onClick={() => update(sel.id, { style: { bg: 'rgba(59,52,46,0.82)', color: '#fbf8f3' } })}>Ink</Chip>
                </div>
              </div>
            )}
            {sel && sel.type === 'image' && (
              <div className="space-y-2 border-t border-beige/70 pt-5">
                <p className="eyebrow">Selected image</p>
                <div className="flex gap-1.5">
                  <Chip active={(sel.style.fit ?? 'cover') === 'cover'} onClick={() => update(sel.id, { style: { fit: 'cover' } })}>Fill frame</Chip>
                  <Chip active={sel.style.fit === 'contain'} onClick={() => update(sel.id, { style: { fit: 'contain' } })}>Show whole image</Chip>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add from your collection" wide>
        {!images.data?.length ? <p className="text-ink-soft">No saved images yet. Use “From device” to upload some.</p> : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.data.map((img) => (
              <button key={img.id} onClick={() => { addImage(img); setPickerOpen(false) }} className="aspect-square overflow-hidden rounded-xl transition hover:opacity-80 cursor-pointer"><Thumb path={img.storage_path} /></button>
            ))}
          </div>
        )}
      </Modal>
      <AffirmationPicker open={affirmOpen} onClose={() => setAffirmOpen(false)} defaults={affirmations} goalId={b.goal_id} onPick={(t) => { addText('affirmation', t); setAffirmOpen(false) }} />
      <BoardSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} board={b} onSaved={(row) => board.setData(row)} onDelete={deleteBoard} />
    </div>
  )
}

// ---------------------------------------------------------------------------
function Canvas({ board, els, selected, onSelect, onChange, imagePath }: {
  board: VisionBoard; els: El[]; selected: string | null
  onSelect: (id: string | null) => void; onChange: (id: string, p: Partial<El>) => void; imagePath: (id: string | null) => string | null
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / board.width))
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [board.width])
  const drag = useRef<null | { id: string; mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; ratio: number | null }>(null)

  const start = (e: RPointerEvent, el: El, mode: 'move' | 'resize') => {
    e.stopPropagation()
    if ((e.target as HTMLElement).isContentEditable && mode === 'move') { onSelect(el.id); return }
    onSelect(el.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h, ratio: el.type === 'image' ? el.h / el.w : null }
  }
  const move = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale
    if (d.mode === 'move') onChange(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) })
    else {
      const w = Math.max(60, d.ow + dx)
      const h = d.ratio && !e.shiftKey ? w * d.ratio : Math.max(40, d.oh + dy)
      onChange(d.id, { w: Math.round(w), h: Math.round(h) })
    }
  }
  const end = () => { drag.current = null }

  return (
    <div ref={wrap} className="relative w-full select-none">
      <div className="relative overflow-hidden rounded-2xl shadow-lift" style={{ height: board.height * scale }} onPointerDown={() => onSelect(null)}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: board.width, height: board.height, transform: `scale(${scale})`, background: board.background }}>
          {[...els].sort((a, b) => a.z - b.z).map((el) => {
            const s = { ...(el.type === 'image' ? {} : TEXT_DEFAULTS[el.type]), ...el.style }
            const isSel = el.id === selected
            return (
              <div key={el.id}
                className={cx('absolute touch-none', isSel ? 'outline outline-[3px] outline-[#64725a]' : 'hover:outline hover:outline-2 hover:outline-[#c9d3bd]')}
                style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, cursor: 'move', zIndex: el.z, outlineOffset: 4 / scale }}
                onPointerDown={(e) => start(e, el, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
              >
                {el.type === 'image' ? (
                  <div className="h-full w-full overflow-hidden bg-linen shadow-[0_10px_28px_-8px_rgba(59,52,46,0.35)]">
                    <ImageFill path={imagePath(el.image_id)} fit={s.fit ?? 'cover'} />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center overflow-hidden rounded-[18px]" style={{ background: s.bg, padding: '0 24px', justifyContent: s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start' }}>
                    <p style={{ fontFamily: s.font === 'sans' ? 'var(--font-sans)' : 'var(--font-display)', fontSize: s.fontSize, color: s.color, fontStyle: s.italic ? 'italic' : 'normal', textAlign: s.align, lineHeight: 1.18, fontWeight: 500, whiteSpace: 'pre-wrap', width: '100%' }}>{el.content}</p>
                  </div>
                )}
                {isSel && (
                  <div onPointerDown={(e) => start(e, el, 'resize')} onPointerMove={move} onPointerUp={end}
                    className="absolute -bottom-3 -right-3 rounded-full border-2 border-white bg-[#64725a] shadow" style={{ width: 22 / scale, height: 22 / scale, cursor: 'nwse-resize' }} />
                )}
              </div>
            )
          })}
          {!els.length && <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-display text-taupe-deep" style={{ fontSize: 48 }}><span className="italic">A blank page for the life you’re imagining.</span><span style={{ fontSize: 26 }} className="mt-4 font-sans">Add images, text and affirmations from the toolbar above.</span></div>}
        </div>
      </div>
    </div>
  )
}

function ImageFill({ path, fit }: { path: string | null; fit: 'cover' | 'contain' }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let live = true; if (path) cachedUrl('vision-images', path).then((u) => live && setUrl(u)).catch(() => {}); return () => { live = false } }, [path])
  if (!url) return <div className="h-full w-full animate-pulse bg-linen" />
  return <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full" style={{ objectFit: fit }} />
}

// ---------------------------------------------------------------------------
// The "conversation" side panel: your written visions for this board.
function VisionPanel({ board }: { board: VisionBoard }) {
  const visions = useData(() => db.list<Vision>('visions', { match: { board_id: board.id }, order: [{ col: 'created_at', asc: true }] }), [board.id])
  const [text, setText] = useState('')
  const { run, busy } = useAction()
  const { confirm } = useFeedback()
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [visions.data?.length])

  const save = () => run(async () => {
    const row = await db.insert<Vision>('visions', { board_id: board.id, goal_id: board.goal_id, description: text.trim(), categories: [board.category] })
    visions.setData((l) => [...(l ?? []), row]); setText('')
  }, 'Vision saved')
  const remove = async (v: Vision) => {
    if (!(await confirm({ title: 'Delete this vision?', confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await db.remove('visions', v.id); visions.setData((l) => l?.filter((x) => x.id !== v.id)) })
  }
  const copy = (s: string) => run(async () => { await navigator.clipboard.writeText(s) }, 'Prompt copied')

  return (
    <Card className="flex h-fit max-h-[80vh] flex-col overflow-hidden">
      <div className="border-b border-beige/70 p-5">
        <p className="eyebrow mb-1">Describe your vision</p>
        <p className="text-[13px] text-ink-soft">Write the life you want in your own words. Each vision is saved to this board{board.goal_id ? ' and its goal' : ''}.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-5 scroll-soft">
        {visions.loading && !visions.data ? <Spinner /> : (visions.data ?? []).map((v) => (
          <div key={v.id} className="group">
            <div className="rounded-3xl rounded-br-lg bg-ink px-4 py-3 text-[14px] text-ivory whitespace-pre-wrap">{v.description}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-taupe-deep">
              <span>{fmt(v.created_at, 'MMM d')}</span>
              <button className="hover:text-ink cursor-pointer" onClick={() => copy(visionToPrompt(v.description, board.category))}>Copy as image prompt</button>
              <button className="hover:text-ink cursor-pointer" onClick={() => remove(v)}>Delete</button>
            </div>
          </div>
        ))}
        {!visions.data?.length && !visions.loading && <p className="font-display text-[1.15rem] italic text-ink-soft">“I want to visualize my dream life in New York — a successful career, a beautiful apartment, wonderful friendships, exciting travel, and feeling confident and happy.”</p>}
        <div className="rounded-2xl bg-blush-50/70 p-3 text-[12px] text-ink-soft">
          {aiStatus.chat && aiStatus.image ? 'Your AI can turn these visions into image prompts and update this board.' : 'When an AI model is connected, it can turn these descriptions into image-generation prompts and suggest board updates. For now your visions are saved, and you can copy a draft prompt.'}
        </div>
        <div ref={endRef} />
      </div>
      <form className="border-t border-beige/70 p-3" onSubmit={(e) => { e.preventDefault(); text.trim() && save() }}>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="I want to feel…" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) save() }} />
        <Button type="submit" variant="primary" size="sm" className="mt-2 w-full" loading={busy} disabled={!text.trim()}>Save vision</Button>
      </form>
    </Card>
  )
}

function AffirmationPicker({ open, onClose, defaults, goalId, onPick }: { open: boolean; onClose: () => void; defaults: string[]; goalId: string | null; onPick: (t: string) => void }) {
  const plans = useData(() => (open ? db.list<ManifestationPlan>('manifestation_plans', goalId ? { match: { goal_id: goalId } } : {}) : Promise.resolve([])), [open, goalId])
  const [custom, setCustom] = useState('')
  const fromPlans = useMemo(() => Array.from(new Set((plans.data ?? []).flatMap((p) => p.affirmations).filter(Boolean))), [plans.data])
  return (
    <Modal open={open} onClose={onClose} title="Add an affirmation">
      <form className="mb-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { onPick(custom.trim()); setCustom('') } }}>
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Write your own…" />
        <Button type="submit" variant="primary" disabled={!custom.trim()}>Add</Button>
      </form>
      {fromPlans.length > 0 && <><p className="eyebrow mb-2">From your goal plans</p><List items={fromPlans} onPick={onPick} /></>}
      <p className="eyebrow mb-2 mt-4">Your affirmations</p>
      <List items={defaults} onPick={onPick} />
    </Modal>
  )
}
const List = ({ items, onPick }: { items: string[]; onPick: (t: string) => void }) => (
  <ul className="space-y-1.5">{items.map((a) => <li key={a}><button onClick={() => onPick(a)} className="w-full rounded-xl bg-linen/60 px-3 py-2 text-left font-display text-[1.1rem] italic hover:bg-linen cursor-pointer">{a}</button></li>)}</ul>
)

function BoardSettings({ open, onClose, board, onSaved, onDelete }: { open: boolean; onClose: () => void; board: VisionBoard; onSaved: (b: VisionBoard) => void; onDelete: () => void }) {
  const goals = useData(() => (open ? db.list<Goal>('goals', { match: { status: 'active' } }) : Promise.resolve([])), [open])
  const chapters = useData(() => (open ? db.list<LifeChapter>('life_chapters', {}) : Promise.resolve([])), [open])
  const [f, setF] = useState(board)
  const { run, busy } = useAction()
  useEffect(() => { if (open) setF(board) }, [open, board])
  const save = () => run(async () => {
    onSaved(await db.update<VisionBoard>('vision_boards', board.id, { title: f.title.trim() || 'Untitled board', category: f.category, description: f.description, goal_id: f.goal_id, chapter_id: f.chapter_id }))
    onClose()
  }, 'Board saved')
  return (
    <Modal open={open} onClose={onClose} title="Board settings" footer={<><Button variant="danger" className="mr-auto" onClick={onDelete}>Delete board</Button><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
        <Field label="Description"><Textarea rows={3} value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Linked goal"><Select value={f.goal_id ?? ''} onChange={(e) => setF({ ...f, goal_id: e.target.value || null })}><option value="">None</option>{(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></Field>
        <Field label="Life chapter"><Select value={f.chapter_id ?? ''} onChange={(e) => setF({ ...f, chapter_id: e.target.value || null })}><option value="">None</option>{(chapters.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
      </div>
    </Modal>
  )
}
