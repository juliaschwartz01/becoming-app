// =============================================================================
// ai-chat — the ONLY place a conversational AI model would be called.
//
// Status: NOT CONNECTED. No AI provider has been chosen or approved.
// Until `callModel` is implemented and AI_PROVIDER is set as a Supabase secret,
// this function returns 503 "not_configured" and never invents a reply.
//
// To connect a provider later (only with the owner's approval):
//   1. Choose a provider and review its pricing, privacy and data-retention policy.
//   2. Store its key as a secret:  supabase secrets set AI_PROVIDER=<name> AI_API_KEY=<key>
//   3. Implement `callModel` below for that provider.
//   4. Deploy: supabase functions deploy ai-chat
//   5. Set VITE_AI_ENABLED=true in GitHub (Settings → Secrets and variables → Actions → Variables).
// =============================================================================
import { cors, json, notConfigured, requireUser } from '../_shared/common.ts'

type Kind = 'confidante' | 'coach' | 'future_self' | 'library' | 'vision'
interface Passage { passage_id: string; resource_id: string; resource_title: string; page_number: number | null; content: string }
interface Body {
  kind: Kind
  mode?: string | null
  message: string
  context: {
    profile: Record<string, unknown> | null
    memories: { id: string; content: string; category: string }[]
    goals: { id: string; title: string; category: string; description: string | null }[]
    evidence: { id: string; title: string; kind: string; occurred_on: string }[]
    passages: Passage[]
    recent: { role: 'user' | 'assistant' | 'system'; content: string }[]
    extra: Record<string, unknown>
  }
}

const BASE = `You are part of "Becoming", a private personal-growth and journaling app used by one person ("the user").
Be warm, thoughtful, intelligent, emotionally aware, natural and curious. Be supportive without simply agreeing:
ask meaningful questions, notice relevant patterns in what the user has shared, and gently challenge their thinking when useful.
You are not a therapist or doctor: never diagnose, never claim clinical expertise, and encourage professional or emergency
support if the user mentions crisis, self-harm or danger. Do not encourage emotional dependency on you; support their real-life relationships.
Use the personal context below only when it is relevant, and never treat a passing feeling as a permanent trait.`

const MODES: Record<string, string> = {
  talk: 'The user mainly wants to be heard. Listen, reflect back, and do not rush to fix.',
  reflect: 'Help them reflect with open, thoughtful questions.',
  perspective: 'Offer a wider, balanced perspective.',
  challenge: 'Respectfully question their assumptions and offer counterpoints.',
  ground: 'Help them slow down and feel grounded; be calm and simple.',
  celebrate: 'Celebrate with them and help them savour the moment.',
}

function systemPrompt(b: Body) {
  const parts = [BASE]
  if (b.kind === 'confidante') parts.push(MODES[b.mode ?? 'talk'] ?? '')
  if (b.kind === 'coach') parts.push(`You are their manifestation coach. Personalise advice using their goals, memories and library. Clearly distinguish spiritual teachings from scientifically established findings, and never imply manifestation guarantees outcomes. When you use a library passage, cite it as [n].`)
  if (b.kind === 'library') parts.push(`Answer ONLY from the numbered library passages provided. Cite every claim as [n]. If the passages do not contain the answer, say so plainly — do not use outside knowledge or invent content.`)
  if (b.kind === 'future_self') parts.push(`Speak as an imagined future version of the user in ${b.context.extra?.future_year ?? 'the future'}. This is an imaginative reflection exercise, not a prediction; never claim to know the future. Ground what you say in their real goals and words.`)
  const c = b.context
  if (c.profile) parts.push(`PROFILE: ${JSON.stringify(c.profile)}`)
  if (c.memories.length) parts.push(`VERIFIED MEMORIES (things the user chose to share):\n${c.memories.map((m) => `- (${m.category}) ${m.content}`).join('\n')}`)
  if (c.goals.length) parts.push(`ACTIVE GOALS:\n${c.goals.map((g) => `- ${g.title}${g.description ? `: ${g.description}` : ''}`).join('\n')}`)
  if (c.evidence.length) parts.push(`THE USER'S REAL EVIDENCE WALL:\n${c.evidence.map((e) => `- ${e.title} (${e.occurred_on})`).join('\n')}`)
  if (c.passages.length) parts.push(`LIBRARY PASSAGES (source knowledge, not facts about the user):\n${c.passages.map((p, i) => `[${i + 1}] ${p.resource_title}${p.page_number ? `, p. ${p.page_number}` : ''}: ${p.content}`).join('\n\n')}`)
  if (Object.keys(c.extra ?? {}).length) parts.push(`SESSION SETTINGS: ${JSON.stringify(c.extra)}`)
  return parts.filter(Boolean).join('\n\n')
}

/** Provider adapter — intentionally unimplemented until a provider is approved. */
async function callModel(_system: string, _messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  throw new Error('not_configured')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    await requireUser(req)
    if (!Deno.env.get('AI_PROVIDER')) return notConfigured('A conversational AI model')
    const body = (await req.json()) as Body
    const history = body.context.recent.filter((m) => m.role !== 'system') as { role: 'user' | 'assistant'; content: string }[]
    const messages = history.length && history[history.length - 1].content === body.message ? history : [...history, { role: 'user' as const, content: body.message }]
    const content = await callModel(systemPrompt(body), messages)
    // Map [n] markers back to the passages that were actually provided.
    const cited = new Set(Array.from(content.matchAll(/\[(\d+)\]/g)).map((m) => Number(m[1]) - 1))
    const citations = body.context.passages.filter((_, i) => cited.has(i)).map((p) => ({ resource_id: p.resource_id, passage_id: p.passage_id, page: p.page_number, title: p.resource_title }))
    return json({ content, citations, memory_ids: body.context.memories.map((m) => m.id), suggested_memories: [] })
  } catch (e) {
    if (e instanceof Response) return e
    if ((e as Error).message === 'not_configured') return notConfigured('A conversational AI model')
    return json({ error: 'failed', message: (e as Error).message }, 500)
  }
})
