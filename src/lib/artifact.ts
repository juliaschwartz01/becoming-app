// =============================================================================
// claude.ai artifact runtime: storage, files, downloads and Claude itself.
//
// When Becoming runs as a Claude artifact:
//   * rows live in the artifact's db under data/users/<your id>/…, a subtree
//     claude.ai keeps private to you (not even the artifact's owner or
//     editors can read anyone else's)
//   * files live in the artifact's asset store
//   * AI calls go through the `sample` capability, on your own Claude account
// Nothing here runs on the GitHub Pages website.
// =============================================================================

import { MemoryBackend, pkOf, type RowStore } from './store-core'
import type { Bucket, TableName } from './types'

// Minimal typings for the parts of the runtime we use (full contract: claude.d.ts).
interface DocSnap { id: string; exists: boolean; data(): Record<string, unknown> | undefined }
interface QuerySnap { docs: DocSnap[] }
interface Query { where(f: string, op: string, v: unknown): Query; orderBy(f: string, d?: 'asc' | 'desc'): Query; limit(n: number): Query; get(): Promise<QuerySnap> }
interface DocRef { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; get(): Promise<DocSnap>; collection(p: string): CollRef }
interface CollRef extends Query { doc(id?: string): DocRef }
interface DB { doc(p: string): DocRef; collection(p: string): CollRef }
interface Assets {
  upload(b: Blob, o?: { type?: string }): Promise<{ id: string; url: string }>
  list(): Promise<{ assets: { id: string; contentType: string; sizeBytes: number }[]; usage: { bytes: number; maxBytes: number; files: number; maxFiles: number } }>
  delete(ref: string): Promise<{ deleted: boolean }>
}
interface User { id(): Promise<string | null>; isOwner(): Promise<boolean> }
interface Downloads { save(r: { filename: string; data: Blob | string }): Promise<unknown> }
export type SampleFn = ((input: string | { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  json<T = unknown>(input: string | { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>): Promise<T>
}
interface ClaudeRuntime { use(name: string): Promise<unknown> }

const runtime = (): ClaudeRuntime | null => (typeof window !== 'undefined' && (window as unknown as { claude?: ClaudeRuntime }).claude) || null
export const use = async <T,>(name: string): Promise<T | null> => {
  const c = runtime()
  if (!c) return null
  try { return (await c.use(name)) as T | null } catch { return null }
}

// -----------------------------------------------------------------------------
// Session
// -----------------------------------------------------------------------------
let session: Promise<{ uid: string | null; db: DB | null; assets: Assets | null }> | null = null
let currentUid: string | null = null

/** Resolves who is viewing and whether storage is available. */
export function artifactSession() {
  if (!session) {
    session = (async () => {
      const [user, db, assets] = await Promise.all([use<User>('user'), use<DB>('db'), use<Assets>('assets')])
      const uid = user ? await user.id() : null
      currentUid = uid
      return { uid, db, assets }
    })()
  }
  return session
}

const errMsg = (e: unknown) => {
  const code = (e as { code?: string })?.code
  if (code === 'quota_exceeded') return 'Your Becoming storage on claude.ai is full. Delete some items or files to make room.'
  if (code === 'resource_exhausted' || code === 'rate_limited') return 'Saving too quickly — wait a moment and try again.'
  if (code === 'revoked' || code === 'not_granted') return 'This view no longer has access to your Becoming storage. Reload the page.'
  if (code === 'too_large') return 'That file is too large (the limit here is 20 MB).'
  if (code === 'unsupported_type') return 'That file type can’t be stored here.'
  if (code === 'quota_or_state') return 'Your file storage on claude.ai is full. Delete some files to make room.'
  return (e as { message?: string })?.message || 'Something went wrong saving to claude.ai.'
}

// -----------------------------------------------------------------------------
// Row store: one document per row, except knowledge passages, which are
// grouped (up to 40 per document) to stay within the store's document limits.
// -----------------------------------------------------------------------------
const SAFE = /[^A-Za-z0-9_\-.~:@+]/g
const safeId = (id: string) => (String(id).replace(SAFE, '_') || 'x').slice(0, 180)
const GROUPED: Partial<Record<TableName, (r: any) => string>> = {
  knowledge_passages: (r) => `${r.resource_id}~${Math.floor((r.passage_index ?? 0) / 40)}`,
}

class ArtifactRowStore implements RowStore {
  private groupOf = new Map<string, string>() // passage id -> group key

  private async coll(t: TableName): Promise<CollRef> {
    const { uid, db } = await artifactSession()
    if (!uid || !db) throw new Error('Open Becoming on claude.ai while signed in to load your data.')
    return db.doc(`data/users/${uid}/tables`).collection(t)
  }

  async load(t: TableName): Promise<any[]> {
    const col = await this.coll(t)
    const docs: DocSnap[] = []
    let last: string | null = null
    for (;;) {
      let q: Query = col.orderBy('_k')
      if (last !== null) q = q.where('_k', '>', last)
      let snap: QuerySnap
      try { snap = await q.limit(1000).get() } catch (e) { throw new Error(errMsg(e)) }
      docs.push(...snap.docs)
      if (snap.docs.length < 1000) break
      last = String(snap.docs[snap.docs.length - 1].data()?._k ?? '')
    }
    const grouped = GROUPED[t]
    const out: any[] = []
    for (const d of docs) {
      const body = d.data() ?? {}
      if (grouped) {
        for (const r of (body.rows as any[]) ?? []) { out.push(r); this.groupOf.set(r.id, String(body._k)) }
      } else {
        const { _k, ...row } = body
        void _k
        out.push(row)
      }
    }
    return out
  }

  async save(t: TableName, changed: any[], removed: string[], all: any[]): Promise<void> {
    const col = await this.coll(t)
    const grouped = GROUPED[t]
    try {
      if (grouped) {
        const keys = new Set<string>()
        for (const r of changed) keys.add(grouped(r))
        for (const id of removed) { const g = this.groupOf.get(id); if (g) keys.add(g); this.groupOf.delete(id) }
        for (const key of keys) {
          const rows = all.filter((r) => grouped(r) === key)
          for (const r of rows) this.groupOf.set(r.id, key)
          const ref = col.doc(safeId(key))
          if (rows.length) await ref.set({ _k: key, rows: JSON.parse(JSON.stringify(rows)) })
          else await ref.delete()
        }
        return
      }
      const pk = pkOf(t)
      for (const r of changed) {
        const key = String(r[pk])
        await col.doc(safeId(key)).set({ ...JSON.parse(JSON.stringify(r)), _k: key })
      }
      for (const id of removed) await col.doc(safeId(id)).delete()
    } catch (e) {
      throw new Error(errMsg(e))
    }
  }
}

// -----------------------------------------------------------------------------
// Files: the artifact's asset store. Types the store can't hold natively
// (EPUB, Word, audio, QuickTime…) are kept as base64 text and decoded on download.
// -----------------------------------------------------------------------------
const NATIVE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf', 'text/csv', 'text/markdown', 'application/json', 'text/plain'])
const WRAP = 'BECOMING-FILE v1\n'
export const ARTIFACT_MAX_NATIVE = 20 * 1024 * 1024
export const ARTIFACT_MAX_WRAPPED = 14 * 1024 * 1024

function toBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
}

export class ArtifactBackend extends MemoryBackend {
  private urls = new Map<string, string>()
  constructor() { super(new ArtifactRowStore(), () => currentUid ?? 'me') }

  private async assets(): Promise<Assets> {
    const { assets } = await artifactSession()
    if (!assets) throw new Error('File storage isn’t available in this view of Becoming.')
    return assets
  }
  async upload(_bucket: Bucket, _path: string, file: Blob, contentType?: string): Promise<string> {
    const a = await this.assets()
    const type = (contentType || file.type || '').split(';')[0].trim()
    try {
      if (NATIVE.has(type)) {
        if (file.size > ARTIFACT_MAX_NATIVE) throw { code: 'too_large' }
        return (await a.upload(file, { type })).id
      }
      if (file.size > ARTIFACT_MAX_WRAPPED) throw { code: 'too_large', message: 'Files of this type can be at most 14 MB here.' }
      const text = `${WRAP}${type || 'application/octet-stream'}\n${await toBase64(file)}`
      const { id } = await a.upload(new Blob([text], { type: 'text/plain' }), { type: 'text/plain' })
      return `b64:${id}`
    } catch (e) {
      const m = (e as { message?: string }).message
      throw new Error(m && (e as { code?: string }).code === 'too_large' ? m : errMsg(e))
    }
  }
  private idOf(path: string) { return path.startsWith('b64:') ? path.slice(4) : path }
  async fileUrl(bucket: Bucket, path: string): Promise<string> {
    if (!path.startsWith('b64:')) return `/_blob/${path}`
    const hit = this.urls.get(path)
    if (hit) return hit
    const url = URL.createObjectURL(await this.download(bucket, path))
    this.urls.set(path, url)
    return url
  }
  async download(_bucket: Bucket, path: string): Promise<Blob> {
    const res = await fetch(`/_blob/${this.idOf(path)}`)
    if (!res.ok) throw new Error('That file could not be found.')
    if (!path.startsWith('b64:')) return res.blob()
    const text = await res.text()
    const [, type, data] = text.match(/^BECOMING-FILE v1\n([^\n]*)\n([\s\S]*)$/) ?? []
    if (data === undefined) return new Blob([text], { type: 'text/plain' })
    const bin = atob(data.trim())
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: type || 'application/octet-stream' })
  }
  async removeFiles(_bucket: Bucket, paths: string[]): Promise<void> {
    const a = await this.assets()
    for (const p of paths) {
      const u = this.urls.get(p)
      if (u) { URL.revokeObjectURL(u); this.urls.delete(p) }
      try { await a.delete(this.idOf(p)) } catch (e) { throw new Error(errMsg(e)) }
    }
  }
  /** Every stored asset (the asset store has no buckets); callers de-duplicate. */
  async listFiles(): Promise<string[]> {
    const a = await this.assets()
    const { assets } = await a.list()
    return assets.map((x) => x.id)
  }
}

/** Storage usage for the Settings page. */
export async function artifactUsage() {
  const a = await use<Assets>('assets')
  if (!a) return null
  try { return (await a.list()).usage } catch { return null }
}

/** Offer a file to the viewer (plain <a download> links are blocked inside artifacts). */
export async function artifactSave(filename: string, data: Blob | string): Promise<void> {
  const d = await use<Downloads>('downloads')
  if (!d) throw new Error('Downloads aren’t available in this view.')
  try { await d.save({ filename, data }) }
  catch (e) {
    const code = (e as { code?: string })?.code
    if (code === 'declined') return
    throw new Error(code === 'rejected_extension' ? 'That file type can’t be downloaded here.' : 'The download didn’t start. Try again.')
  }
}

/** Claude, through the viewer's own account. Null when this view can't use it. */
export const getSample = () => use<SampleFn>('sample')
