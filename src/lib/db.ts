// A small data layer used by every page.
// In cloud mode it talks to Supabase (protected by Row Level Security).
// In preview mode (no Supabase configured yet) it stores data in this browser only,
// so the interface can be explored before setup. The UI always labels preview mode.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval'
import { config } from './config'
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

export const supabase: SupabaseClient | null = config.cloud
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

const PK: Partial<Record<TableName, string>> = { profiles: 'user_id', user_preferences: 'user_id' }
export const pkOf = (t: TableName) => PK[t] ?? 'id'

export const PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000000'

function friendly(e: unknown): Error {
  const msg = (e as { message?: string })?.message || String(e)
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return new Error('Could not reach the cloud. Check your internet connection and try again.')
  if (/JWT|not authenticated|401/i.test(msg)) return new Error('Your session has expired. Please sign in again.')
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return new Error('The database tables are missing. Run the SQL migrations in Supabase (see README).')
  return new Error(msg)
}

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
  upload(bucket: Bucket, path: string, file: Blob, contentType?: string): Promise<void>
  fileUrl(bucket: Bucket, path: string, expiresIn?: number): Promise<string>
  download(bucket: Bucket, path: string): Promise<Blob>
  removeFiles(bucket: Bucket, paths: string[]): Promise<void>
  listFiles(bucket: Bucket, prefix: string): Promise<string[]>
}

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------
class SupabaseBackend implements Backend {
  constructor(private sb: SupabaseClient) {}

  async list<T>(table: TableName, o: ListOptions = {}): Promise<T[]> {
    if (o.limit) return this.page<T>(table, o, 0, o.limit - 1)
    // Supabase returns at most 1000 rows per request, so read in pages.
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
      const rows = await this.page<T>(table, o, from, from + 999)
      out.push(...rows)
      if (rows.length < 1000) return out
    }
  }
  private async page<T>(table: TableName, o: ListOptions, from: number, to: number): Promise<T[]> {
    let q = this.sb.from(table).select(o.select ?? '*')
    for (const [k, v] of Object.entries(o.match ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as never)
    for (const f of o.filters ?? []) {
      if (f.op === 'in') q = q.in(f.col, f.value as never[])
      else if (f.op === 'contains') q = q.contains(f.col, f.value as never)
      else q = (q as any)[f.op](f.col, f.value)
    }
    if (o.search?.text.trim()) q = q.textSearch(o.search.col, o.search.text.trim(), { type: 'websearch', config: 'english' })
    for (const ord of o.order ?? []) q = q.order(ord.col, { ascending: ord.asc ?? false })
    if (!o.order?.length) q = q.order(pkOf(table), { ascending: true }) // stable paging
    const { data, error } = await q.range(from, to)
    if (error) throw friendly(error)
    return (data ?? []) as T[]
  }
  async get<T>(table: TableName, id: string): Promise<T | null> {
    const { data, error } = await this.sb.from(table).select('*').eq(pkOf(table), id).maybeSingle()
    if (error) throw friendly(error)
    return (data as T) ?? null
  }
  async insert<T>(table: TableName, row: Partial<T>): Promise<T> {
    const { data, error } = await this.sb.from(table).insert(row as never).select().single()
    if (error) throw friendly(error)
    return data as T
  }
  async insertMany<T>(table: TableName, rows: Partial<T>[]): Promise<T[]> {
    if (!rows.length) return []
    const out: T[] = []
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await this.sb.from(table).insert(rows.slice(i, i + 200) as never).select()
      if (error) throw friendly(error)
      out.push(...((data ?? []) as T[]))
    }
    return out
  }
  async update<T>(table: TableName, id: string, patch: Partial<T>): Promise<T> {
    const { search: _s, ...clean } = patch as Record<string, unknown>
    void _s
    const { data, error } = await this.sb.from(table).update(clean as never).eq(pkOf(table), id).select().single()
    if (error) throw friendly(error)
    return data as T
  }
  async upsert<T>(table: TableName, row: Partial<T>, onConflict?: string): Promise<T> {
    const { data, error } = await this.sb.from(table).upsert(row as never, { onConflict: onConflict ?? pkOf(table) }).select().single()
    if (error) throw friendly(error)
    return data as T
  }
  async remove(table: TableName, id: string): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq(pkOf(table), id)
    if (error) throw friendly(error)
  }
  async removeWhere(table: TableName, match: Record<string, unknown>): Promise<void> {
    let q = this.sb.from(table).delete()
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v as never)
    const { error } = await q
    if (error) throw friendly(error)
  }
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args)
    if (error) throw friendly(error)
    return data as T
  }
  async upload(bucket: Bucket, path: string, file: Blob, contentType?: string) {
    const { error } = await this.sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: contentType || file.type || undefined })
    if (error) throw friendly(error)
  }
  async fileUrl(bucket: Bucket, path: string, expiresIn = 3600) {
    const { data, error } = await this.sb.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error) throw friendly(error)
    return data.signedUrl
  }
  async download(bucket: Bucket, path: string) {
    const { data, error } = await this.sb.storage.from(bucket).download(path)
    if (error) throw friendly(error)
    return data
  }
  async removeFiles(bucket: Bucket, paths: string[]) {
    if (!paths.length) return
    const { error } = await this.sb.storage.from(bucket).remove(paths)
    if (error) throw friendly(error)
  }
  async listFiles(bucket: Bucket, prefix: string) {
    const out: string[] = []
    const walk = async (dir: string) => {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await this.sb.storage.from(bucket).list(dir, { limit: 1000, offset })
        if (error) throw friendly(error)
        for (const item of data ?? []) {
          const full = `${dir}/${item.name}`
          if (item.id === null) await walk(full)
          else out.push(full)
        }
        if ((data ?? []).length < 1000) break
      }
    }
    await walk(prefix)
    return out
  }
}

// ---------------------------------------------------------------------------
// Preview backend (browser only) — also used by automated tests
// ---------------------------------------------------------------------------
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function memoryKV(): KV {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}

function words(s: string) {
  return s.toLowerCase().replace(/<<|>>/g, '').split(/[^\p{L}\p{N}']+/u).filter((w) => w.length > 1)
}

export class LocalBackend implements Backend {
  private urlCache = new Map<string, string>()
  constructor(private kv: KV = typeof localStorage !== 'undefined' ? localStorage : memoryKV(), private userId = PREVIEW_USER_ID) {}

  private key(t: TableName) { return `becoming-preview:${t}` }
  private read<T>(t: TableName): T[] {
    try { return JSON.parse(this.kv.getItem(this.key(t)) || '[]') } catch { return [] }
  }
  private write(t: TableName, rows: unknown[]) {
    try { this.kv.setItem(this.key(t), JSON.stringify(rows)) }
    catch { throw new Error('This browser’s preview storage is full. Connect Supabase to store more.') }
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
    const r: any = { user_id: this.userId, created_at: now, updated_at: now, ...defaultsFor(t), ...row }
    const pk = pkOf(t)
    if (!r[pk]) r[pk] = pk === 'user_id' ? this.userId : uuid()
    return r as T
  }
  async list<T>(t: TableName, o: ListOptions = {}): Promise<T[]> {
    let rows = this.read<any>(t).filter((r) => this.matches(r, o))
    for (const ord of [...(o.order ?? [])].reverse()) {
      rows = rows.sort((a, b) => {
        const x = a[ord.col] ?? '', y = b[ord.col] ?? ''
        return (x < y ? -1 : x > y ? 1 : 0) * (ord.asc ? 1 : -1)
      })
    }
    return (o.limit ? rows.slice(0, o.limit) : rows) as T[]
  }
  async get<T>(t: TableName, id: string) {
    return (this.read<any>(t).find((r) => r[pkOf(t)] === id) as T) ?? null
  }
  async insert<T>(t: TableName, row: Partial<T>) {
    const rows = this.read<any>(t)
    const r = this.stamp(t, row)
    this.checkUnique(t, rows, r)
    rows.push(r); this.write(t, rows)
    return r
  }
  async insertMany<T>(t: TableName, input: Partial<T>[]) {
    const rows = this.read<any>(t)
    const out = input.map((r) => this.stamp(t, r))
    rows.push(...out); this.write(t, rows)
    return out
  }
  async update<T>(t: TableName, id: string, patch: Partial<T>) {
    const rows = this.read<any>(t)
    const i = rows.findIndex((r) => r[pkOf(t)] === id)
    if (i < 0) throw new Error('That item no longer exists.')
    rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() }
    this.write(t, rows)
    return rows[i] as T
  }
  async upsert<T>(t: TableName, row: Partial<T>, onConflict?: string) {
    const rows = this.read<any>(t)
    const cols = (onConflict ?? pkOf(t)).split(',').map((c) => c.trim())
    const full: any = this.stamp(t, row)
    const i = rows.findIndex((r) => cols.every((c) => r[c] === full[c]))
    if (i >= 0) {
      rows[i] = { ...rows[i], ...row, updated_at: new Date().toISOString() }
      this.write(t, rows)
      return rows[i] as T
    }
    rows.push(full); this.write(t, rows)
    return full as T
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
    this.write(t, this.read<any>(t).filter((r) => r[pkOf(t)] !== id))
    this.cascade(t, [id])
  }
  async removeWhere(t: TableName, match: Record<string, unknown>) {
    const all = this.read<any>(t)
    const gone = all.filter((r) => this.matches(r, { match }))
    this.write(t, all.filter((r) => !this.matches(r, { match })))
    this.cascade(t, gone.map((r) => r[pkOf(t)]))
  }
  /** Mirrors the ON DELETE CASCADE rules in the SQL schema. */
  private cascade(t: TableName, ids: string[]) {
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
      const rows = this.read<any>(child)
      const removed = rows.filter((r) => ids.includes(r[col]))
      if (removed.length) {
        this.write(child, rows.filter((r) => !ids.includes(r[col])))
        this.cascade(child, removed.map((r) => r.id))
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
      const resources = new Map(this.read<any>('knowledge_resources').map((r) => [r.id, r]))
      const hits = this.read<any>('knowledge_passages')
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
      return this.read<any>('memories')
        .filter((m) => m.status === 'verified')
        .map((m) => ({ m, s: score(m.content + ' ' + m.category) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.m.importance - a.m.importance)
        .slice(0, limit)
        .map((x) => x.m) as T
    }
    throw new Error(`Unknown function ${fn}`)
  }
  private fk(bucket: Bucket, path: string) { return `becoming-preview-file:${bucket}/${path}` }
  async upload(bucket: Bucket, path: string, file: Blob) {
    await idbSet(this.fk(bucket, path), file)
    this.urlCache.delete(this.fk(bucket, path))
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

export const db: Backend = supabase ? new SupabaseBackend(supabase) : new LocalBackend()
