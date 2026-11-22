import { db } from './db'
import { ALL_TABLES, type Attachment, type Bucket, type TableName } from './types'

const BUCKETS: Bucket[] = ['knowledge', 'vision-images', 'attachments']

/** Every row you own, from every table. */
export async function exportAllData(onProgress?: (msg: string) => void) {
  const out: Record<string, unknown[]> = {}
  for (const t of ALL_TABLES) {
    onProgress?.(`Exporting ${t.replace(/_/g, ' ')}…`)
    out[t] = await db.list(t, {})
    for (const row of out[t] as Record<string, unknown>[]) delete row.search
  }
  return { app: 'Becoming', exported_at: new Date().toISOString(), version: 1, data: out }
}

/** Files referenced by your records, with the folder they belong to. */
async function referencedFiles(data?: Record<string, unknown[]>) {
  const rows = data ?? (await exportAllData()).data
  const files: { bucket: Bucket; path: string; name: string }[] = []
  for (const r of (rows.vision_images ?? []) as { storage_path: string; title: string | null }[]) if (r.storage_path) files.push({ bucket: 'vision-images', path: r.storage_path, name: r.title || 'image' })
  for (const r of (rows.knowledge_resources ?? []) as { storage_path: string | null; file_name: string | null }[]) if (r.storage_path) files.push({ bucket: 'knowledge', path: r.storage_path, name: r.file_name || 'file' })
  for (const e of (rows.journal_entries ?? []) as { attachments: Attachment[] }[]) for (const a of e.attachments ?? []) files.push({ bucket: 'attachments', path: a.path, name: a.name })
  return files
}

/** A .zip with data.json plus every stored file. */
export async function exportEverythingZip(onProgress?: (msg: string) => void): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const data = await exportAllData(onProgress)
  zip.file('data.json', JSON.stringify(data, null, 2))
  const files = await referencedFiles(data.data)
  let n = 0
  for (const f of files) {
    onProgress?.(`Collecting files… ${++n} of ${files.length}`)
    try { zip.file(`files/${f.bucket}/${n}-${f.name.replace(/[\\/]/g, '-')}`, await db.download(f.bucket, f.path)) } catch { /* a missing file is skipped */ }
  }
  onProgress?.('Compressing…')
  return zip.generateAsync({ type: 'blob' })
}

export async function exportMemories() {
  const [profiles, memories] = await Promise.all([db.list('profiles', {}), db.list('memories', { order: [{ col: 'created_at' }] })])
  for (const m of memories as Record<string, unknown>[]) delete m.search
  return { app: 'Becoming', kind: 'memory-export', exported_at: new Date().toISOString(), profile: profiles[0] ?? null, memories }
}

/**
 * Bring records from a Becoming data export (.json) into this copy of Becoming.
 * Rows keep their ids, so importing the same file twice skips what already exists.
 * Files are not part of a .json export and are not imported.
 */
export async function importData(json: unknown, onProgress?: (msg: string) => void) {
  const data = (json as { app?: string; data?: Record<string, unknown[]> })
  if (data?.app !== 'Becoming' || !data.data) throw new Error('That file isn’t a Becoming data export.')
  let added = 0
  for (const t of ALL_TABLES) {
    const rows = (data.data[t] ?? []) as Record<string, unknown>[]
    if (!rows.length) continue
    onProgress?.(`Importing ${t.replace(/_/g, ' ')}…`)
    if (t === 'profiles' || t === 'user_preferences') {
      const { user_id, created_at, updated_at, search, ...rest } = rows[0]
      void user_id; void created_at; void updated_at; void search
      const existing = await db.list<Record<string, unknown>>(t, { limit: 1 })
      if (existing[0]) await db.update(t, String(existing[0].user_id), rest)
      else await db.insert(t, rest)
      continue
    }
    const have = new Set((await db.list<{ id: string }>(t, {})).map((r) => r.id))
    const fresh = rows.filter((r) => !have.has(String(r.id))).map(({ user_id, search, ...rest }) => { void user_id; void search; return rest })
    for (let i = 0; i < fresh.length; i += 200) await db.insertMany(t as TableName, fresh.slice(i, i + 200))
    added += fresh.length
  }
  return added
}

/**
 * Permanently delete all personal content (rows and files).
 */
export async function deleteAllData(onProgress?: (msg: string) => void) {
  onProgress?.('Deleting files…')
  const seen = new Set<string>()
  for (const f of await referencedFiles()) {
    if (seen.has(f.path)) continue
    seen.add(f.path)
    await db.removeFiles(f.bucket, [f.path]).catch(() => {})
  }
  for (const b of BUCKETS) {
    const uidPrefix = String(((await db.list<{ user_id: string }>('profiles', { limit: 1 }))[0]?.user_id) ?? '')
    const paths = (await db.listFiles(b, uidPrefix).catch(() => [] as string[])).filter((p) => !seen.has(p))
    paths.forEach((p) => seen.add(p))
    for (let i = 0; i < paths.length; i += 100) await db.removeFiles(b, paths.slice(i, i + 100))
  }
  // Children first, then parents.
  const order: TableName[] = [
    'messages', 'conversations', 'knowledge_passages', 'knowledge_resources', 'vision_board_elements', 'visions', 'vision_images', 'vision_boards',
    'manifestation_plans', 'milestones', 'practices', 'method_notes', 'ritual_completions', 'reminders', 'mood_entries', 'journal_entries',
    'reflections', 'limiting_beliefs', 'memories', 'achievements', 'monthly_reviews', 'goals', 'life_chapters', 'user_preferences', 'profiles',
  ]
  for (const t of order) {
    onProgress?.(`Deleting ${t.replace(/_/g, ' ')}…`)
    const rows = await db.list<Record<string, unknown>>(t, {})
    if (rows.length) await db.removeWhere(t, { user_id: rows[0].user_id })
  }
}
