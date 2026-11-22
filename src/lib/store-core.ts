// Storage primitives shared by every backend (no Supabase, no claude.ai code here).
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import type { Bucket, TableName } from './types'

export type Op = 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in' | 'contains' | 'is'
export interface Filter { col: string; op: Op; value: unknown }
export interface ListOptions {
  match?: Record<string, unknown>
  filters?: Filter[]
  order?: { col: string; asc?: boolean }[]
  limit?: number
  /** Full-text search over a tsvector column (cloud) or a naive text match (preview). */
  search?: { col: string; text: string }
  select?: string
}

const PK: Partial<Record<TableName, string>> = { profiles: 'user_id', user_preferences: 'user_id' }
export const pkOf = (t: TableName) => PK[t] ?? 'id'

export const PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000000'

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------
export interface Backend {
  list<T>(table: TableName, opts?: ListOptions): Promise<T[]>
  get<T>(table: TableName, id: string): Promise<T | null>
  insert<T>(table: TableName, row: Partial<T>): Promise<T>
  insertMany<T>(table: TableName, rows: Partial<T>[]): Promise<T[]>
  update<T>(table: TableName, id: string, patch: Partial<T>): Promise<T>
  upsert<T>(table: TableName, row: Partial<T>, onConflict?: string): Promise<T>
  remove(table: TableName, id: string): Promise<void>
  removeWhere(table: TableName, match: Record<string, unknown>): Promise<void>
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>
  /** Stores a file and resolves the path/id to keep (it may differ from `path`). */
  upload(bucket: Bucket, path: string, file: Blob, contentType?: string): Promise<string>
  fileUrl(bucket: Bucket, path: string, expiresIn?: number): Promise<string>
  download(bucket: Bucket, path: string): Promise<Blob>
  removeFiles(bucket: Bucket, paths: string[]): Promise<void>
  listFiles(bucket: Bucket, prefix: string): Promise<string[]>
}

// ---------------------------------------------------------------------------
// In-memory backend with a pluggable row store. Used for:
//   * preview mode (rows in localStorage, files in IndexedDB) and tests
//   * the claude.ai artifact build (see ./artifact.ts)
// It mirrors the SQL schema's defaults, unique keys and ON DELETE CASCADE.
// ---------------------------------------------------------------------------
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function memoryKV(): KV {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

function words(s: string) {
  return s.toLowerCase().replace(/<<|>>/g, '').split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 1)
}

/** Where a MemoryBackend persists rows. */
export interface RowStore {
  load(t: TableName): Promise<any[]>
  /** Persist a change. `changed` rows were added or modified, `removed` are primary keys; `all` is the table after the change. */
  save(t: TableName, changed: any[], removed: string[], all: any[]): Promise<void>
}

export function kvRowStore(kv: KV = typeof localStorage !== 'undefined' ? localStorage : memoryKV()): RowStore {
  const key = (t: TableName) => `becoming-preview:${t}`
  return {
    async load(t) { try { return JSON.parse(kv.getItem(key(t)) || '[]') } catch { return [] } },
    async save(t, _c, _r, all) {
      try { kv.setItem(key(t), JSON.stringify(all)) }
      catch { throw new Error('This browser’s preview storage is full.') }
    },
  }
}

export abstract class MemoryBackend implements Backend {
  private cache = new Map<TableName, any[]>()
  private loading = new Map<TableName, Promise<any[]>>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(protected store: RowStore, protected getUserId: () => string) {}

  private async rows(t: TableName): Promise<any[]> {
    const hit = this.cache.get(t)
    if (hit) return hit
    let p = this.loading.get(t)
    if (!p) {
      p = this.store.load(t).then((r) => { this.cache.set(t, r); return r }).finally(() => this.loading.delete(t))
      this.loading.set(t, p)
    }
    return p
  }
  /** Apply a change to the cache, then persist it (writes are serialized). */
  private async commit(t: TableName, all: any[], changed: any[], removed: string[]) {
    this.cache.set(t, all)
    const run = this.queue.then(() => this.store.save(t, changed, removed, all))
    this.queue = run.catch(() => {})
    await run
  }
  private matches(row: any, o: ListOptions): boolean {
    for (const [k, v] of Object.entries(o.match ?? {})) if ((row[k] ?? null) !== v) return false
    for (const f of o.filters ?? []) {
      const val = row[f.col]
      switch (f.op) {
        case 'eq': if (val !== f.value) return false; break
        case 'neq': if (val === f.value) return false; break
        case 'gte': if (!(val >= (f.value as any))) return false; break
        case 'lte': if (!(val <= (f.value as any))) return false; break
        case 'gt': if (!(val > (f.value as any))) return false; break
        case 'lt': if (!(val < (f.value as any))) return false; break
        case 'in': if (!(f.value as unknown[]).includes(val)) return false; break
        case 'is': if ((val ?? null) !== f.value) return false; break
        case 'contains': if (!(f.value as unknown[]).every((x) => (val ?? []).includes(x))) return false; break
      }
    }
    if (o.search?.text.trim()) {
      const hay = JSON.stringify(row).toLowerCase()
      if (!words(o.search.text).every((w) => hay.includes(w))) return false
    }
    return true
  }
  private stamp<T>(t: TableName, row: Partial<T>): T {
    const now = new Date().toISOString()
    const uid = this.getUserId()
    const r: any = { user_id: uid, created_at: now, updated_at: now, ...defaultsFor(t), ...row }
    const pk = pkOf(t)
    if (!r[pk]) r[pk] = pk === 'user_id' ? uid : uuid()
    return r as T
  }
  async list<T>(t: TableName, o: ListOptions = {}): Promise<T[]> {
    let rows = (await this.rows(t)).filter((r) => this.matches(r, o))
    for (const ord of [...(o.order ?? [])].reverse()) {
      rows = rows.sort((a, b) => {
        const x = a[ord.col] ?? '', y = b[ord.col] ?? ''
        return (x < y ? -1 : x > y ? 1 : 0) * (ord.asc ? 1 : -1)
      })
    }
    return structuredClone(o.limit ? rows.slice(0, o.limit) : rows) as T[]
  }
  async get<T>(t: TableName, id: string) {
    const r = (await this.rows(t)).find((x) => x[pkOf(t)] === id)
    return r ? (structuredClone(r) as T) : null
  }
  async insert<T>(t: TableName, row: Partial<T>) {
    const rows = await this.rows(t)
    const r = this.stamp(t, row)
    this.checkUnique(t, rows, r)
    await this.commit(t, [...rows, r], [r], [])
    return structuredClone(r)
  }
  async insertMany<T>(t: TableName, input: Partial<T>[]) {
    const rows = await this.rows(t)
    const out = input.map((r) => this.stamp(t, r))
    await this.commit(t, [...rows, ...out], out, [])
    return structuredClone(out)
  }
  async update<T>(t: TableName, id: string, patch: Partial<T>) {
    const rows = await this.rows(t)
    const i = rows.findIndex((r) => r[pkOf(t)] === id)
    if (i < 0) throw new Error('That item no longer exists.')
    const next = { ...rows[i], ...patch, updated_at: new Date().toISOString() }
    const all = rows.slice(); all[i] = next
    await this.commit(t, all, [next], [])
    return structuredClone(next) as T
  }
  async upsert<T>(t: TableName, row: Partial<T>, onConflict?: string) {
    const rows = await this.rows(t)
    const cols = (onConflict ?? pkOf(t)).split(',').map((c) => c.trim())
    const full: any = this.stamp(t, row)
    const i = rows.findIndex((r) => cols.every((c) => r[c] === full[c]))
    if (i >= 0) {
      const next = { ...rows[i], ...row, updated_at: new Date().toISOString() }
      const all = rows.slice(); all[i] = next
      await this.commit(t, all, [next], [])
      return structuredClone(next) as T
    }
    await this.commit(t, [...rows, full], [full], [])
    return structuredClone(full) as T
  }
  private checkUnique(t: TableName, rows: any[], r: any) {
    const uniques: Partial<Record<TableName, string[]>> = {
      ritual_completions: ['ritual_date', 'period', 'practice_key'],
      method_notes: ['method_key'],
      manifestation_plans: ['goal_id'],
      monthly_reviews: ['month'],
    }
    const cols = uniques[t]
    if (cols && rows.some((x) => cols.every((c) => x[c] === r[c]))) throw new Error('This item already exists.')
  }
  async remove(t: TableName, id: string) {
    const rows = await this.rows(t)
    await this.commit(t, rows.filter((r) => r[pkOf(t)] !== id), [], [id])
    await this.cascade(t, [id])
  }
  async removeWhere(t: TableName, match: Record<string, unknown>) {
    const all = await this.rows(t)
    const gone = all.filter((r) => this.matches(r, { match }))
    if (!gone.length) return
    const ids = gone.map((r) => r[pkOf(t)])
    await this.commit(t, all.filter((r) => !this.matches(r, { match })), [], ids)
    await this.cascade(t, ids)
  }
  /** Mirrors the ON DELETE CASCADE rules in the SQL schema. */
  private async cascade(t: TableName, ids: string[]) {
    if (!ids.length) return
    const rules: Partial<Record<TableName, [TableName, string][]>> = {
      conversations: [['messages', 'conversation_id']],
      vision_boards: [['vision_board_elements', 'board_id'], ['visions', 'board_id']],
      vision_images: [['vision_board_elements', 'image_id']],
      knowledge_resources: [['knowledge_passages', 'resource_id']],
      goals: [['manifestation_plans', 'goal_id']],
      life_chapters: [['milestones', 'chapter_id']],
    }
    for (const [child, col] of rules[t] ?? []) {
      const rows = await this.rows(child)
      const removed = rows.filter((r) => ids.includes(r[col]))
      if (removed.length) {
        const rid = removed.map((r) => r.id)
        await this.commit(child, rows.filter((r) => !ids.includes(r[col])), [], rid)
        await this.cascade(child, rid)
      }
    }
  }
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const query = String(args.query ?? '')
    const terms = words(query).filter((w) => w !== 'or' && w !== 'and')
    const limit = Number(args.match_count ?? 8)
    const score = (text: string) => {
      const w = words(text)
      return terms.reduce((s, t) => s + w.filter((x) => x.startsWith(t)).length, 0)
    }
    if (fn === 'search_passages') {
      const resources = new Map((await this.rows('knowledge_resources')).map((r) => [r.id, r]))
      const hits = (await this.rows('knowledge_passages'))
        .map((p) => ({ p, s: score(p.content) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map(({ p, s }) => {
          const r = resources.get(p.resource_id) || {}
          return {
            passage_id: p.id, resource_id: p.resource_id, resource_title: r.title ?? 'Untitled',
            resource_author: r.author ?? null, resource_type: r.type ?? 'note', page_number: p.page_number,
            passage_index: p.passage_index, snippet: highlight(p.content, terms), content: p.content, rank: s,
          }
        })
      return hits as T
    }
    if (fn === 'search_memories') {
      return structuredClone((await this.rows('memories'))
        .filter((m) => m.status === 'verified')
        .map((m) => ({ m, s: score(m.content + ' ' + m.category) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.m.importance - a.m.importance)
        .slice(0, limit)
        .map((x) => x.m)) as T
    }
    throw new Error(`Unknown function ${fn}`)
  }
  abstract upload(bucket: Bucket, path: string, file: Blob, contentType?: string): Promise<string>
  abstract fileUrl(bucket: Bucket, path: string, expiresIn?: number): Promise<string>
  abstract download(bucket: Bucket, path: string): Promise<Blob>
  abstract removeFiles(bucket: Bucket, paths: string[]): Promise<void>
  abstract listFiles(bucket: Bucket, prefix: string): Promise<string[]>
}

/** Preview mode: rows in localStorage, files in this browser's IndexedDB. */
export class LocalBackend extends MemoryBackend {
  private urlCache = new Map<string, string>()
  constructor(kv?: KV, userId = PREVIEW_USER_ID) { super(kvRowStore(kv), () => userId) }

  private fk(bucket: Bucket, path: string) { return `becoming-preview-file:${bucket}/${path}` }
  async upload(bucket: Bucket, path: string, file: Blob) {
    await idbSet(this.fk(bucket, path), file)
    this.urlCache.delete(this.fk(bucket, path))
    return path
  }
  async fileUrl(bucket: Bucket, path: string) {
    const k = this.fk(bucket, path)
    const cached = this.urlCache.get(k)
    if (cached) return cached
    const blob = await idbGet<Blob>(k)
    if (!blob) throw new Error('File not found in this browser.')
    const u = URL.createObjectURL(blob)
    this.urlCache.set(k, u)
    return u
  }
  async download(bucket: Bucket, path: string) {
    const blob = await idbGet<Blob>(this.fk(bucket, path))
    if (!blob) throw new Error('File not found in this browser.')
    return blob
  }
  async removeFiles(bucket: Bucket, paths: string[]) {
    for (const p of paths) {
      const k = this.fk(bucket, p)
      const u = this.urlCache.get(k)
      if (u) URL.revokeObjectURL(u)
      this.urlCache.delete(k)
      await idbDel(k)
    }
  }
  async listFiles(bucket: Bucket, prefix: string) {
    const start = this.fk(bucket, prefix)
    const all = (await idbKeys()) as string[]
    return all.filter((k) => typeof k === 'string' && k.startsWith(start)).map((k) => k.slice(`becoming-preview-file:${bucket}/`.length))
  }
}

/** Mirrors the column defaults in the SQL migration so preview data has the same shape. */
function defaultsFor(t: TableName): Record<string, unknown> {
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const D: Partial<Record<TableName, Record<string, unknown>>> = {
    profiles: { personal_values: [], priorities: [] },
    user_preferences: { dashboard_widgets: [], affirmations: [], memory_suggestions_enabled: false, settings: {} },
    life_chapters: { affirmations: [], status: 'current', description: null, start_date: null, end_date: null, cover_image_id: null },
    goals: { category: 'personal-growth', status: 'active', description: null, target_date: null, completed_at: null, chapter_id: null },
    manifestation_plans: { affirmations: [], journaling_prompts: [], actions: [], source: 'manual' },
    milestones: { done: false, done_at: null, notes: null, due_date: null, chapter_id: null, goal_id: null },
    journal_entries: { body: '', tags: [], favorite: false, attachments: [], entry_date: today, chapter_id: null, goal_id: null, prompt: null },
    mood_entries: { themes: [], energy: null, context: null, journal_entry_id: null },
    reflections: { kind: 'realization', body: null },
    limiting_beliefs: { status: 'exploring', reflections: [], origin: null, alternative: null, practice_key: null },
    practices: { content: {}, reflection: null, goal_id: null },
    method_notes: { notes: '' },
    ritual_completions: { ritual_date: today, content: null },
    reminders: { repeat: 'none', kind: 'general', done: false, last_done_on: null, notes: null, goal_id: null },
    memories: { category: 'about-me', origin: 'user', status: 'verified', importance: 2, goal_id: null, source_conversation_id: null },
    conversations: { title: 'New conversation', context: {}, archived: false, mode: null, goal_id: null },
    messages: { citations: [], memory_ids: [] },
    vision_boards: { title: 'Untitled board', category: 'lifestyle', background: '#f4ede3', width: 1600, height: 1000, description: null, goal_id: null, chapter_id: null },
    vision_images: { category: 'lifestyle', source: 'upload', board_id: null, prompt: null, title: null },
    vision_board_elements: { x: 0, y: 0, w: 300, h: 300, rotation: 0, z: 0, style: {}, content: null, image_id: null },
    visions: { categories: [], goal_id: null },
    knowledge_resources: { type: 'note', category: 'manifestation', tags: [], extraction_status: 'none', favorite: false, author: null, description: null, url: null, storage_path: null, personal_notes: null, page_count: null },
    knowledge_passages: { page_number: null },
    achievements: { kind: 'achievement', occurred_on: today, is_breakthrough: false, description: null, goal_id: null, chapter_id: null, image_id: null },
    monthly_reviews: { snapshot: {} },
  }
  return structuredClone(D[t] ?? {})
}

function highlight(content: string, terms: string[]) {
  const lower = content.toLowerCase()
  const first = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, first - 120)
  let s = (start > 0 ? '… ' : '') + content.slice(start, start + 320) + (start + 320 < content.length ? ' …' : '')
  for (const t of terms) s = s.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\p{L}]*)`, 'giu'), '<<$1>>')
  return s
}

