import { db, uuid } from './db'
import { requireUserId } from './auth'
import { chunkText, safeFileName } from './utils'
import type { KnowledgePassage, KnowledgeResource } from './types'

export const MAX_FILE = 50 * 1024 * 1024 // Supabase free plan per-file limit

/** Replace a resource's searchable passages with freshly chunked text. */
export async function replacePassages(resourceId: string, pages: { page: number | null; text: string }[]) {
  await db.removeWhere('knowledge_passages', { resource_id: resourceId })
  const chunks = chunkText(pages)
  await db.insertMany<KnowledgePassage>('knowledge_passages', chunks.map((c, i) => ({ resource_id: resourceId, passage_index: i, page_number: c.page, content: c.content })))
  return chunks.length
}

export async function uploadKnowledgeFile(file: File) {
  if (file.size > MAX_FILE) throw new Error(`“${file.name}” is larger than 50 MB, the free-plan limit per file.`)
  const path = `${requireUserId()}/${uuid()}-${safeFileName(file.name)}`
  await db.upload('knowledge', path, file, file.type || undefined)
  return path
}

export async function deleteResource(r: KnowledgeResource) {
  await db.remove('knowledge_resources', r.id) // passages cascade
  if (r.storage_path) await db.removeFiles('knowledge', [r.storage_path])
}

export function guessType(file: File): string {
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.epub')) return 'book'
  if (/\.(docx?|rtf|odt)$/.test(n)) return 'document'
  if (/\.(txt|md|markdown|html?)$/.test(n)) return 'document'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'transcript'
  if (file.type.startsWith('image/')) return 'screenshot'
  return 'document'
}
