// The data layer used by every page. Three backends share one interface:
//   * SupabaseBackend — the GitHub Pages website (Row Level Security in Supabase)
//   * ArtifactBackend — the claude.ai artifact build (private per-person storage on claude.ai)
//   * LocalBackend    — preview mode: this browser only, clearly bannered
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config, isArtifact } from './config'
import type { Bucket, TableName } from './types'
import { LocalBackend, pkOf, type Backend, type ListOptions } from './store-core'
import { ArtifactBackend } from './artifact'

export * from './store-core'

export const supabase: SupabaseClient | null = config.cloud
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null

function friendly(e: unknown): Error {
  const msg = (e as { message?: string })?.message || String(e)
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return new Error('Could not reach the cloud. Check your internet connection and try again.')
  if (/JWT|not authenticated|401/i.test(msg)) return new Error('Your session has expired. Please sign in again.')
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return new Error('The database tables are missing. Run the SQL migrations in Supabase (see README).')
  return new Error(msg)
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
    return path
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

export const db: Backend = isArtifact ? new ArtifactBackend() : supabase ? new SupabaseBackend(supabase) : new LocalBackend()
