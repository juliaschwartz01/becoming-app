// Text extraction for the Knowledge Library. Runs entirely in your browser —
// no outside service sees your documents.
//
// Supported: PDF (selectable text, with page numbers), EPUB, DOCX, TXT, Markdown, HTML.
// Not supported: scanned/image-only PDFs, images, video/audio (add a transcript manually instead).

export interface Extracted {
  status: 'extracted' | 'unsupported' | 'failed'
  pages: { page: number | null; text: string }[]
  pageCount?: number
  message?: string
}

export function canExtract(file: File) {
  const n = file.name.toLowerCase()
  return /\.(pdf|epub|docx|txt|md|markdown|html?)$/.test(n) || file.type === 'application/pdf' || file.type.startsWith('text/')
}

export async function extractText(file: File): Promise<Extracted> {
  const n = file.name.toLowerCase()
  try {
    if (n.endsWith('.pdf') || file.type === 'application/pdf') return await extractPdf(file)
    if (n.endsWith('.epub')) return await extractEpub(file)
    if (n.endsWith('.docx')) return await extractDocx(file)
    if (/\.(html?)$/.test(n)) return single(htmlToText(await file.text()))
    if (/\.(txt|md|markdown)$/.test(n) || file.type.startsWith('text/')) return single(await file.text())
    return { status: 'unsupported', pages: [], message: 'Text can’t be read from this file type. You can add notes or a transcript manually.' }
  } catch (e) {
    return { status: 'failed', pages: [], message: `Couldn’t read this file: ${(e as Error).message}` }
  }
}

function single(text: string): Extracted {
  return text.trim() ? { status: 'extracted', pages: [{ page: null, text }] } : { status: 'unsupported', pages: [], message: 'This file has no readable text.' }
}

async function extractPdf(file: File): Promise<Extracted> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const pages: { page: number; text: string }[] = []
  let chars = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== 'string') continue
      text += item.str + (item.hasEOL ? '\n' : ' ')
    }
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    chars += text.length
    if (text) pages.push({ page: i, text })
  }
  await task.destroy()
  if (chars < Math.max(40, doc.numPages * 15)) {
    return { status: 'unsupported', pages: [], pageCount: doc.numPages, message: 'This PDF looks scanned or image-only, so it has no selectable text. You can add notes or the text manually.' }
  }
  return { status: 'extracted', pages, pageCount: doc.numPages }
}

async function extractDocx(file: File): Promise<Extracted> {
  const mammoth: any = await import('mammoth')
  const lib = mammoth.default ?? mammoth
  const { value } = await lib.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return single(value)
}

async function extractEpub(file: File): Promise<Extracted> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const container = await zip.file('META-INF/container.xml')?.async('string')
  if (!container) throw new Error('Not a valid EPUB')
  const parser = new DOMParser()
  const opfPath = parser.parseFromString(container, 'application/xml').querySelector('rootfile')?.getAttribute('full-path')
  if (!opfPath) throw new Error('EPUB has no package file')
  const opf = parser.parseFromString(await zip.file(opfPath)!.async('string'), 'application/xml')
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const manifest = new Map<string, string>()
  opf.querySelectorAll('manifest > item').forEach((it) => manifest.set(it.getAttribute('id')!, it.getAttribute('href')!))
  const pages: { page: number | null; text: string }[] = []
  for (const ref of Array.from(opf.querySelectorAll('spine > itemref'))) {
    const href = manifest.get(ref.getAttribute('idref') ?? '')
    if (!href) continue
    const f = zip.file(decodeURIComponent(base + href))
    if (!f) continue
    const text = htmlToText(await f.async('string'))
    if (text.trim()) pages.push({ page: null, text })
  }
  return pages.length ? { status: 'extracted', pages } : { status: 'unsupported', pages: [], message: 'No readable text found in this EPUB (it may be protected by DRM).' }
}

function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,nav').forEach((n) => n.remove())
  doc.querySelectorAll('p,div,br,h1,h2,h3,h4,h5,h6,li,blockquote,section').forEach((n) => n.append('\n\n'))
  return (doc.body?.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}
