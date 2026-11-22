import type { BoardElement } from './types'

export const BOARD_BACKGROUNDS = ['#f4ede3', '#fbf8f3', '#efe6d8', '#e6dac8', '#e1e7d9', '#f1dfd8', '#e9e0ea', '#3b342e']

export const TEXT_DEFAULTS: Record<'text' | 'affirmation', BoardElement['style']> = {
  text: { fontSize: 64, color: '#3b342e', font: 'display', align: 'left', italic: false },
  affirmation: { fontSize: 42, color: '#3b342e', font: 'display', align: 'center', italic: true, bg: 'rgba(251,248,243,0.88)' },
}

type Box = Pick<BoardElement, 'id' | 'type' | 'x' | 'y' | 'w' | 'h' | 'rotation'>

/** Arrange elements into a preset layout. Returns new positions (only for images unless noted). */
export function arrange(elements: Box[], layout: 'grid' | 'collage' | 'center', W: number, H: number): Record<string, Partial<Box>> {
  const out: Record<string, Partial<Box>> = {}
  const imgs = elements.filter((e) => e.type === 'image')
  const texts = elements.filter((e) => e.type !== 'image')
  const pad = 48
  if (layout === 'grid' && imgs.length) {
    const cols = Math.ceil(Math.sqrt(imgs.length * (W / H)))
    const rows = Math.ceil(imgs.length / cols)
    const cw = (W - pad * (cols + 1)) / cols
    const ch = (H - pad * (rows + 1)) / rows
    imgs.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      out[e.id] = { x: pad + c * (cw + pad), y: pad + r * (ch + pad), w: cw, h: ch, rotation: 0 }
    })
  }
  if (layout === 'collage' && imgs.length) {
    // Deterministic scrapbook layout: overlapping tiles with small rotations.
    const cols = Math.max(2, Math.ceil(Math.sqrt(imgs.length * 1.4)))
    const rows = Math.ceil(imgs.length / cols)
    const cw = W / cols, ch = H / rows
    imgs.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols)
      const jitter = ((i * 37) % 7) - 3
      const w = cw * 1.08, h = ch * 1.02
      out[e.id] = { x: c * cw - cw * 0.04 + jitter * 4, y: r * ch - ch * 0.01 + jitter * 3, w, h, rotation: jitter * 0.8 }
    })
  }
  if (layout === 'center' || layout === 'collage') {
    texts.forEach((e, i) => {
      const w = Math.min(W * 0.6, Math.max(e.w, 500))
      out[e.id] = { ...(out[e.id] ?? {}), x: (W - w) / 2, y: H * 0.38 + i * 130, w, rotation: 0 }
    })
  }
  return out
}

/** Wrap text into lines that fit a width, using a canvas context for measurement. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word } else line = test
    }
    lines.push(line)
  }
  return lines
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('An image on the board could not be loaded for export.'))
    img.src = src
  })
}

/** Render a board to a PNG blob. Images are drawn with "cover" or "contain" fit. */
export async function renderBoardPng(board: { width: number; height: number; background: string }, elements: BoardElement[], urlFor: (imageId: string) => Promise<string>): Promise<Blob> {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = board.width
  canvas.height = board.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = board.background
  ctx.fillRect(0, 0, board.width, board.height)
  for (const el of [...elements].sort((a, b) => a.z - b.z)) {
    ctx.save()
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2)
    ctx.rotate((el.rotation * Math.PI) / 180)
    ctx.translate(-el.w / 2, -el.h / 2)
    if (el.type === 'image' && el.image_id) {
      const img = await loadImage(await urlFor(el.image_id))
      const fit = el.style?.fit ?? 'cover'
      const ir = img.width / img.height, br = el.w / el.h
      let sx = 0, sy = 0, sw = img.width, sh = img.height, dx = 0, dy = 0, dw = el.w, dh = el.h
      if (fit === 'cover') {
        if (ir > br) { sw = img.height * br; sx = (img.width - sw) / 2 } else { sh = img.width / br; sy = (img.height - sh) / 2 }
      } else {
        if (ir > br) { dh = el.w / ir; dy = (el.h - dh) / 2 } else { dw = el.h * ir; dx = (el.w - dw) / 2 }
      }
      ctx.shadowColor = 'rgba(59,52,46,0.18)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 8
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
    } else {
      const s = { ...TEXT_DEFAULTS[el.type === 'affirmation' ? 'affirmation' : 'text'], ...el.style }
      if (s.bg) { ctx.fillStyle = s.bg; roundRect(ctx, 0, 0, el.w, el.h, 18); ctx.fill() }
      const family = s.font === 'sans' ? '"DM Sans Variable", sans-serif' : '"Cormorant Garamond", serif'
      ctx.font = `${s.italic ? 'italic ' : ''}500 ${s.fontSize}px ${family}`
      ctx.fillStyle = s.color ?? '#3b342e'
      ctx.textBaseline = 'top'
      const padX = 24, lh = (s.fontSize ?? 40) * 1.18
      const lines = wrapLines(ctx, el.content ?? '', el.w - padX * 2)
      const totalH = lines.length * lh
      let y = Math.max(16, (el.h - totalH) / 2)
      for (const line of lines) {
        const w = ctx.measureText(line).width
        const x = s.align === 'center' ? (el.w - w) / 2 : s.align === 'right' ? el.w - padX - w : padX
        ctx.fillText(line, x, y)
        y += lh
      }
    }
    ctx.restore()
  }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), 'image/png'))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Read an image file's natural size. */
export function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve({ width: 800, height: 800 }); URL.revokeObjectURL(url) }
    img.src = url
  })
}
