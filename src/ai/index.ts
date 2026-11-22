// =============================================================================
// AI integration layer
//
// What works TODAY (no AI provider needed):
//   * buildContext(): retrieves the relevant personal memories, goals, evidence,
//     knowledge-library passages (with page citations) and recent messages for a
//     conversation. This is real retrieval over your Supabase data and is shown in
//     the "What the AI would see" panel.
//
// What needs an AI model (switched off until you approve a provider):
//   * sendChat()       → Supabase Edge Function "ai-chat"
//   * generateImages() → Supabase Edge Function "ai-image"
//   * transcribe()     → Supabase Edge Function "ai-transcribe"
//
// AI credentials must only ever be stored as Supabase Edge Function secrets,
// never in this frontend code or in GitHub.
// =============================================================================

import { config } from '../lib/config'
import { db, supabase } from '../lib/db'
import type {
  Achievement, Citation, ConversationKind, Goal, Memory, Message, PassageHit, Profile,
} from '../lib/types'

export const aiStatus = {
  chat: config.cloud && config.aiEnabled,
  image: config.cloud && config.imageGenerationEnabled,
  transcription: config.cloud && config.transcriptionEnabled,
}

export interface ContextBundle {
  profile: Pick<Profile, 'preferred_name' | 'about' | 'personal_values' | 'priorities' | 'communication_style'> | null
  memories: Pick<Memory, 'id' | 'content' | 'category'>[]
  goals: Pick<Goal, 'id' | 'title' | 'category' | 'description'>[]
  evidence: Pick<Achievement, 'id' | 'title' | 'kind' | 'occurred_on'>[]
  passages: PassageHit[]
  recent: Pick<Message, 'role' | 'content'>[]
  extra: Record<string, unknown>
}

const STOP = new Set('a an and are as at be but by for from has have how i if in into is it its me my of on or our so that the their them then there these this to was we what when where which who why will with you your can should do does did am im ive help guide create make want feel'.split(' '))
/** Turn a natural-language message into an OR keyword query for full-text search. */
export function keywordQuery(text: string): string {
  const words = Array.from(new Set(text.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? [])).filter((w) => !STOP.has(w.replace(/'/g, '')))
  return words.slice(0, 10).join(' or ')
}

/**
 * Gather only the context relevant to this message — never the whole history.
 * Knowledge (sources) and personal memories are kept in separate sections.
 */
export async function buildContext(opts: {
  kind: ConversationKind
  message: string
  conversationId?: string | null
  goalId?: string | null
  extra?: Record<string, unknown>
}): Promise<ContextBundle> {
  const q = keywordQuery(opts.message)
  const wantsKnowledge = opts.kind === 'coach' || opts.kind === 'library'
  const wantsEvidence = opts.kind !== 'library' && /encourag|doubt|proud|remind|evidence|can't|cannot|confiden|believe in|worth/i.test(opts.message)

  const [profiles, memoriesHit, memoriesTop, goals, passages, evidence, recent] = await Promise.all([
    opts.kind === 'library' ? Promise.resolve([]) : db.list<Profile>('profiles', { limit: 1 }),
    opts.kind === 'library' || !q ? Promise.resolve([] as Memory[]) : db.rpc<Memory[]>('search_memories', { query: q, match_count: 8 }).catch(() => []),
    opts.kind === 'library' ? Promise.resolve([] as Memory[]) : db.list<Memory>('memories', { match: { status: 'verified' }, filters: [{ col: 'importance', op: 'eq', value: 3 }], limit: 5 }),
    opts.kind === 'library' ? Promise.resolve([] as Goal[]) : db.list<Goal>('goals', { match: { status: 'active' }, order: [{ col: 'updated_at' }], limit: 8 }),
    wantsKnowledge && q ? db.rpc<PassageHit[]>('search_passages', { query: q, match_count: 6 }).catch(() => []) : Promise.resolve([] as PassageHit[]),
    wantsEvidence ? db.list<Achievement>('achievements', { order: [{ col: 'occurred_on' }], limit: 6 }) : Promise.resolve([] as Achievement[]),
    opts.conversationId ? db.list<Message>('messages', { match: { conversation_id: opts.conversationId }, order: [{ col: 'created_at' }], limit: 12 }) : Promise.resolve([] as Message[]),
  ])

  const seen = new Set<string>()
  const memories = [...memoriesTop, ...memoriesHit].filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(0, 10)
  const p = profiles[0]
  let goalList = goals
  if (opts.goalId && !goals.some((g) => g.id === opts.goalId)) {
    const g = await db.get<Goal>('goals', opts.goalId)
    if (g) goalList = [g, ...goals]
  }

  return {
    profile: p ? { preferred_name: p.preferred_name, about: p.about, personal_values: p.personal_values, priorities: p.priorities, communication_style: p.communication_style } : null,
    memories: memories.map(({ id, content, category }) => ({ id, content, category })),
    goals: goalList.map(({ id, title, category, description }) => ({ id, title, category, description })),
    evidence: evidence.map(({ id, title, kind, occurred_on }) => ({ id, title, kind, occurred_on })),
    passages,
    recent: recent.reverse().map(({ role, content }) => ({ role, content })),
    extra: opts.extra ?? {},
  }
}

export interface ChatReply { content: string; citations: Citation[]; memory_ids: string[]; suggested_memories?: string[] }

export class AINotConfiguredError extends Error {
  constructor(what = 'An AI model') { super(`${what} isn’t connected yet. See Settings → AI connection.`) }
}

/** Send a conversation turn to the server-side AI function. Never simulated. */
export async function sendChat(input: {
  kind: ConversationKind
  mode?: string | null
  message: string
  context: ContextBundle
}): Promise<ChatReply> {
  if (!aiStatus.chat || !supabase) throw new AINotConfiguredError()
  const { data, error } = await supabase.functions.invoke('ai-chat', { body: input })
  if (error) throw new Error(error.message || 'The AI service did not respond.')
  if (!data?.content) throw new Error('The AI service returned an empty reply.')
  return data as ChatReply
}

/**
 * Image generation. Reference photos are passed straight to the server function
 * for this single request and are never written to Supabase Storage.
 * Returns temporary image URLs/data that the user may choose to save.
 */
export async function generateImages(input: { prompt: string; referencePhotos?: File[]; count?: number }): Promise<{ images: { dataUrl: string }[] }> {
  if (!aiStatus.image || !supabase) throw new AINotConfiguredError('An image-generation model')
  const refs = await Promise.all((input.referencePhotos ?? []).map(fileToDataUrl))
  const { data, error } = await supabase.functions.invoke('ai-image', { body: { prompt: input.prompt, references: refs, count: input.count ?? 2 } })
  if (error) throw new Error(error.message || 'Image generation failed.')
  return data
}

/** Optional transcription of an uploaded audio/video file. */
export async function transcribe(input: { storagePath: string }): Promise<{ text: string; segments?: { start: number; text: string }[] }> {
  if (!aiStatus.transcription || !supabase) throw new AINotConfiguredError('A transcription service')
  const { data, error } = await supabase.functions.invoke('ai-transcribe', { body: input })
  if (error) throw new Error(error.message || 'Transcription failed.')
  return data
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })
}

/** Turn a written vision into a draft image-generation prompt (deterministic, no AI). */
export function visionToPrompt(description: string, category: string): string {
  const clean = description.replace(/\s+/g, ' ').trim()
  return `Soft, cinematic lifestyle photograph, natural light, warm ivory and sage palette, editorial composition. Theme: ${category}. Scene: ${clean}`
}
