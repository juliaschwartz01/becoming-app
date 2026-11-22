import { db } from './db'
import { requireUserId } from './auth'
import { ALL_TABLES, type Bucket, type TableName } from './types'

const BUCKETS: Bucket[] = ['knowledge', 'vision-images', 'attachments']

/** Every row you own, from every table. Row Level Security guarantees it is only your data. */
export async function exportAllData(onProgress?: (msg: string) => void) {
  const out: Record<string, unknown[]> = {}
  for (const t of ALL_TABLES) {
    onProgress?.(`Exporting ${t.replace(/_/g, ' ')}…`)
    out[t] = await db.list(t, {})
    for (const row of out[t] as Record<string, unknown>[]) delete row.search
  }
  return { app: 'Becoming', exported_at: new Date().toISOString(), version: 1, data: out }
}

/** A .zip with data.json plus every stored file. */
export async function exportEverythingZip(onProgress?: (msg: string) => void): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const data = await exportAllData(onProgress)
  zip.file('data.json', JSON.stringify(data, null, 2))
  const uid = requireUserId()
  for (const b of BUCKETS) {
    onProgress?.(`Collecting files from ${b}…`)
    const paths = await db.listFiles(b, uid)
    for (const p of paths) zip.file(`files/${b}/${p.replace(`${uid}/`, '')}`, await db.download(b, p))
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
 * Permanently delete all personal content (rows and files). The login itself stays;
 * it can be removed in the Supabase dashboard (Authentication → Users).
 */
export async function deleteAllData(onProgress?: (msg: string) => void) {
  const uid = requireUserId()
  for (const b of BUCKETS) {
    onProgress?.(`Deleting files in ${b}…`)
    const paths = await db.listFiles(b, uid)
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
    await db.removeWhere(t, { user_id: uid })
  }
}
