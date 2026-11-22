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

import { config, isArtifact } from '../lib/config'
import { db, supabase } from '../lib/db'
import { getSample } from '../lib/artifact'
import { systemPrompt } from './prompts'
import type {
  Achievement, Citation, ConversationKind, Goal, Memory, Message, PassageHit, Profile,
} from '../lib/types'

export const aiStatus = {
  /** On claude.ai: Claude through your own account. On the website: only once a provider is connected. */
  chat: isArtifact || (config.cloud && config.aiEnabled),
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

/** Turn Claude's sampling errors into plain words. */
export function aiErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'not_granted': return 'Becoming isn’t allowed to use Claude in this view. You can allow it from the artifact’s Permissions menu.'
    case 'sampling_disabled': return 'Claude isn’t available for this account.'
    case 'rate_limited': return (e as { reason?: string }).reason === 'usage_limit' ? 'You’ve reached your Claude usage limit for now. Try again later.' : 'Too many requests at once. Wait a moment and try again.'
    case 'session_expired': return 'Your claude.ai session expired. Sign in again and reload.'
    case 'refused': return 'Claude declined to answer that. Try rephrasing.'
    case 'prompt_too_large': return 'That’s too much text for one request. Try something shorter.'
    case 'cancelled': return 'Stopped.'
    case 'invalid_json': return 'Claude’s answer came back in an unexpected format. Try again.'
    default: return (e as { message?: string })?.message || 'Claude didn’t respond. Try again.'
  }
}

/** Ask Claude through the viewer's own account (claude.ai build). */
async function sampleOrThrow() {
  const sample = await getSample()
  if (!sample) throw new AINotConfiguredError('Claude')
  return sample
}

/** Send a conversation turn. Never simulated: it either reaches a real model or fails clearly. */
export async function sendChat(input: {
  kind: ConversationKind
  mode?: string | null
  message: string
  context: ContextBundle
  onText?: (text: string) => void
  signal?: AbortSignal
}): Promise<ChatReply> {
  if (isArtifact) {
    const sample = await sampleOrThrow()
    const rules = systemPrompt(input.kind, input.mode, input.context)
    const history = input.context.recent.filter((m) => m.role !== 'system' && m.content.trim()) as { role: 'user' | 'assistant'; content: string }[]
    const turns = history.length && history[history.length - 1].role === 'user' ? history : [...history, { role: 'user' as const, content: input.message }]
    try {
      const { text } = await sample([{ role: 'user', content: `${rules}\n\n(These are standing instructions and context for the conversation that follows.)` }, ...turns], {
        cache: false,
        signal: input.signal,
        modelTier: 'default',
        onText: input.onText ? ({ text }: { text: string }) => input.onText!(text) : undefined,
      })
      return { content: text, citations: citationsFrom(text, input.context), memory_ids: input.context.memories.map((m) => m.id) }
    } catch (e) {
      throw new Error(aiErrorMessage(e))
    }
  }
  if (!aiStatus.chat || !supabase) throw new AINotConfiguredError()
  const { data, error } = await supabase.functions.invoke('ai-chat', { body: { kind: input.kind, mode: input.mode, message: input.message, context: input.context } })
  if (error) throw new Error(error.message || 'The AI service did not respond.')
  if (!data?.content) throw new Error('The AI service returned an empty reply.')
  return data as ChatReply
}

/** Map [n] markers in a reply to the library passages that were actually provided. */
export function citationsFrom(text: string, context: ContextBundle): Citation[] {
  const cited = new Set(Array.from(text.matchAll(/\[(\d+)\]/g)).map((m) => Number(m[1]) - 1))
  return context.passages.filter((_, i) => cited.has(i)).map((p) => ({ resource_id: p.resource_id, passage_id: p.passage_id, page: p.page_number, title: p.resource_title }))
}

/** A one-off request for structured ideas (vision boards, plans). Claude account only. */
export async function askClaudeJSON<T>(prompt: string, opts: { quick?: boolean } = {}): Promise<T> {
  if (!isArtifact) throw new AINotConfiguredError()
  const sample = await sampleOrThrow()
  try { return await sample.json<T>(prompt, { cache: false, modelTier: opts.quick ? 'quick' : 'default' }) }
  catch (e) { throw new Error(aiErrorMessage(e)) }
}

/**
 * Lasting facts worth remembering from one message — only when the user has
 * switched memory suggestions on. Suggestions wait for approval on the Memory page.
 */
export async function suggestMemories(message: string, known: string[]): Promise<string[]> {
  if (!isArtifact) return []
  const out = await askClaudeJSON<unknown>(`You help a private journaling app remember things about its one user.
From the user's message below, extract at most 2 LASTING facts or preferences that would still be true in months (values, important people, long-term goals, how they like to be supported, real milestones).
Never record temporary feelings, moods, one-off events, or anything uncertain. Write each as a short third-person sentence starting with "The user".
Skip anything already known. Reply with only a JSON array of strings (possibly empty), e.g. ["The user is training for a half marathon in May."].

ALREADY KNOWN:
${known.slice(0, 30).map((k) => `- ${k}`).join('\n') || '(nothing yet)'}

MESSAGE:
${message.slice(0, 4000)}`, { quick: true })
  return Array.isArray(out) ? out.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 2) : []
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
