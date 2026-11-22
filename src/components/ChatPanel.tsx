import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, BookOpen, Eye, MessageCircle, Pencil, Plus, Trash2, Unplug } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import type { Conversation, ConversationKind, Message } from '../lib/types'
import { aiStatus, buildContext, sendChat, type ContextBundle } from '../ai'
import { useProfile } from '../lib/profile'
import { Button, Card, EmptyState, ErrorState, IconButton, Loading, Modal, Spinner, Textarea, useAction, useFeedback } from './ui'
import { cx, fmt, highlightParts } from '../lib/utils'

export function AISetupNotice({ what = 'conversations', compact }: { what?: string; compact?: boolean }) {
  return (
    <div className={cx('flex gap-3 rounded-2xl border border-blush-100 bg-blush-50/70 text-[13.5px] text-ink', compact ? 'p-3' : 'p-4')}>
      <Unplug className="mt-0.5 size-4 shrink-0 text-blush-deep" />
      <div>
        <p className="font-medium">AI setup required for live {what}</p>
        <p className="mt-0.5 text-ink-soft">
          No AI model is connected, so there are no replies — nothing here is simulated. Your messages are still saved, and you can see exactly
          which memories, goals and sources would be shared. <Link to="/settings" className="underline decoration-sand underline-offset-2 hover:text-ink">Learn about connecting one</Link>.
        </p>
      </div>
    </div>
  )
}

export function ContextPreview({ bundle }: { bundle: ContextBundle }) {
  const Section = ({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) => (
    <div className="mb-5">
      <p className="eyebrow mb-2">{title}</p>
      {empty ? <p className="text-[13px] text-taupe-deep">Nothing relevant found.</p> : children}
    </div>
  )
  return (
    <div className="text-[14px]">
      <p className="mb-5 text-ink-soft">Only relevant pieces are retrieved for each message — never your whole history. Knowledge sources and personal memories are kept separate.</p>
      {bundle.profile && (
        <Section title="Profile" empty={false}>
          <p>{bundle.profile.preferred_name || 'No preferred name yet'}{bundle.profile.communication_style ? ` · prefers ${bundle.profile.communication_style}` : ''}</p>
          {bundle.profile.personal_values?.length > 0 && <p className="text-ink-soft">Values: {bundle.profile.personal_values.join(', ')}</p>}
        </Section>
      )}
      <Section title="Verified memories" empty={!bundle.memories.length}>
        <ul className="space-y-1.5">{bundle.memories.map((m) => <li key={m.id} className="rounded-xl bg-linen/60 px-3 py-2">{m.content}</li>)}</ul>
      </Section>
      <Section title="Active goals" empty={!bundle.goals.length}>
        <ul className="list-disc pl-5">{bundle.goals.map((g) => <li key={g.id}>{g.title}</li>)}</ul>
      </Section>
      {bundle.evidence.length > 0 && (
        <Section title="Evidence wall" empty={false}>
          <ul className="list-disc pl-5">{bundle.evidence.map((e) => <li key={e.id}>{e.title} <span className="text-taupe-deep">· {fmt(e.occurred_on)}</span></li>)}</ul>
        </Section>
      )}
      <Section title="Knowledge library passages" empty={!bundle.passages.length}>
        <ul className="space-y-2">
          {bundle.passages.map((p) => (
            <li key={p.passage_id} className="rounded-xl border border-beige/70 bg-white/70 px-3 py-2">
              <Link to={`/library/${p.resource_id}?passage=${p.passage_id}`} className="text-[13px] font-medium hover:underline">
                {p.resource_title}{p.page_number ? ` · p. ${p.page_number}` : ''}
              </Link>
              <p className="mt-1 text-[13px] text-ink-soft">{highlightParts(p.snippet).map((s, i) => s.hit ? <mark key={i} className="bg-blush-100 text-ink">{s.text}</mark> : <span key={i}>{s.text}</span>)}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Recent messages in this conversation" empty={!bundle.recent.length}>
        <p className="text-ink-soft">{bundle.recent.length} message{bundle.recent.length === 1 ? '' : 's'}</p>
      </Section>
    </div>
  )
}

interface ChatPanelProps {
  kind: ConversationKind
  title: string
  placeholder?: string
  starters?: string[]
  /** Optional controls shown above the conversation (e.g., mode, future year). */
  renderSetup?: (conv: Conversation | null, update: (patch: Partial<Conversation>) => void) => ReactNode
  newConversationDefaults?: () => Partial<Conversation>
  contextExtra?: (conv: Conversation | null) => Record<string, unknown>
  emptyTitle?: string
  emptyBody?: ReactNode
}

export default function ChatPanel(props: ChatPanelProps) {
  const { kind } = props
  const { prefs } = useProfile()
  const { confirm } = useFeedback()
  const { run } = useAction()
  const threads = useData(() => db.list<Conversation>('conversations', { match: { kind, archived: false }, order: [{ col: 'updated_at' }] }), [kind])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<ContextBundle | null>(null)
  const [renaming, setRenaming] = useState<Conversation | null>(null)
  const [draftConv, setDraftConv] = useState<Partial<Conversation>>(() => props.newConversationDefaults?.() ?? {})
  const endRef = useRef<HTMLDivElement>(null)

  const active = threads.data?.find((t) => t.id === activeId) ?? null

  useEffect(() => {
    if (!activeId && threads.data?.length) setActiveId(threads.data[0].id)
  }, [threads.data, activeId])

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true); setMsgError(null)
    try { setMessages(await db.list<Message>('messages', { match: { conversation_id: id }, order: [{ col: 'created_at', asc: true }] })) }
    catch (e) { setMsgError((e as Error).message) }
    finally { setLoadingMsgs(false) }
  }
  useEffect(() => { if (activeId) loadMessages(activeId); else setMessages([]) }, [activeId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length])

  const updateConv = (patch: Partial<Conversation>) => {
    if (!active) { setDraftConv((d) => ({ ...d, ...patch })); return }
    threads.setData((list) => list?.map((t) => (t.id === active.id ? { ...t, ...patch } : t)))
    db.update<Conversation>('conversations', active.id, patch).catch(() => threads.reload())
  }

  const startNew = () => { setActiveId(null); setMessages([]); setDraftConv(props.newConversationDefaults?.() ?? {}) }

  const send = async (content: string) => {
    const body = content.trim()
    if (!body || sending) return
    setSending(true)
    try {
      let conv = active
      if (!conv) {
        conv = await db.insert<Conversation>('conversations', {
          kind, title: body.slice(0, 60) + (body.length > 60 ? '…' : ''), context: {}, ...draftConv,
        })
        threads.setData((l) => [conv!, ...(l ?? [])])
        setActiveId(conv.id)
      }
      const userMsg = await db.insert<Message>('messages', { conversation_id: conv.id, role: 'user', content: body, citations: [], memory_ids: [] })
      setMessages((m) => [...m, userMsg])
      setText('')
      await db.update<Conversation>('conversations', conv.id, { updated_at: new Date().toISOString() } as Partial<Conversation>)
      if (aiStatus.chat) {
        const context = await buildContext({ kind, message: body, conversationId: conv.id, goalId: conv.goal_id, extra: { ...props.contextExtra?.(conv), ...conv.context } })
        const reply = await sendChat({ kind, mode: conv.mode, message: body, context })
        const aiMsg = await db.insert<Message>('messages', { conversation_id: conv.id, role: 'assistant', content: reply.content, citations: reply.citations ?? [], memory_ids: reply.memory_ids ?? [] })
        setMessages((m) => [...m, aiMsg])
        if (reply.suggested_memories?.length && prefs?.memory_suggestions_enabled) {
          await db.insertMany('memories', reply.suggested_memories.map((c) => ({ content: c, origin: 'ai_inferred', status: 'pending', source_conversation_id: conv!.id })))
        }
      }
    } catch (e) {
      setMsgError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const showContext = async (message: string) => {
    await run(async () => setPreview(await buildContext({ kind, message, conversationId: active?.id, goalId: active?.goal_id, extra: props.contextExtra?.(active) })))
  }

  const remove = async (c: Conversation) => {
    if (!(await confirm({ title: 'Delete this conversation?', body: 'The conversation and all of its messages will be permanently deleted.', confirmLabel: 'Delete', danger: true }))) return
    await run(async () => {
      await db.remove('conversations', c.id)
      threads.setData((l) => l?.filter((x) => x.id !== c.id))
      if (activeId === c.id) startNew()
    }, 'Conversation deleted')
  }

  const lastUserWithoutReply = (i: number) => messages[i].role === 'user' && (i === messages.length - 1 || messages[i + 1].role === 'user')

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Threads */}
      <aside className="order-2 lg:order-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">Past conversations</p>
          <IconButton label="New conversation" onClick={startNew}><Plus className="size-4" /></IconButton>
        </div>
        {threads.loading && !threads.data ? <Spinner /> : threads.error ? <ErrorState message={threads.error} onRetry={threads.reload} /> : (
          <ul className="space-y-1">
            {(threads.data ?? []).map((t) => (
              <li key={t.id} className="group flex items-center gap-1">
                <button onClick={() => setActiveId(t.id)} className={cx('flex-1 truncate rounded-xl px-3 py-2 text-left text-[13.5px] transition cursor-pointer', t.id === activeId ? 'bg-white shadow-soft' : 'text-ink-soft hover:bg-white/60')}>
                  <span className="block truncate">{t.title}</span>
                  <span className="block text-[11px] text-taupe-deep">{fmt(t.updated_at, 'MMM d')}</span>
                </button>
                <span className="hidden gap-0.5 group-hover:flex">
                  <IconButton label="Rename" className="size-7" onClick={() => setRenaming(t)}><Pencil className="size-3.5" /></IconButton>
                  <IconButton label="Delete" className="size-7" onClick={() => remove(t)}><Trash2 className="size-3.5" /></IconButton>
                </span>
              </li>
            ))}
            {!threads.data?.length && <li className="px-3 text-[13px] text-taupe-deep">No conversations yet.</li>}
          </ul>
        )}
      </aside>

      {/* Conversation */}
      <Card className="order-1 flex min-h-[560px] flex-col overflow-hidden lg:order-2">
        <div className="border-b border-beige/70 px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-2xl">{active?.title ?? props.title}</h2>
            <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={startNew}>New</Button>
          </div>
          {props.renderSetup && <div className="mt-3">{props.renderSetup(active ?? (draftConv as Conversation), updateConv)}</div>}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-7 scroll-soft">
          {!aiStatus.chat && <AISetupNotice />}
          {msgError && <ErrorState message={msgError} onRetry={() => activeId && loadMessages(activeId)} />}
          {loadingMsgs ? <Loading label="Opening conversation…" /> : messages.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="size-7" strokeWidth={1.2} />}
              title={props.emptyTitle ?? 'Begin whenever you’re ready'}
              body={props.emptyBody}
              action={props.starters && (
                <div className="flex max-w-xl flex-wrap justify-center gap-2">
                  {props.starters.map((s) => <button key={s} onClick={() => setText(s)} className="rounded-full border border-beige bg-white/70 px-3 py-1.5 text-[13px] text-ink-soft hover:border-sand hover:text-ink cursor-pointer">{s}</button>)}
                </div>
              )}
            />
          ) : messages.map((m, i) => (
            <div key={m.id} className={cx('flex flex-col animate-rise', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-3xl px-5 py-3 text-[15px] leading-relaxed', m.role === 'user' ? 'rounded-br-lg bg-ink text-ivory' : 'rounded-bl-lg bg-linen/80 text-ink')}>
                {m.content}
              </div>
              {m.citations?.length > 0 && (
                <div className="mt-1.5 flex max-w-[85%] flex-wrap gap-1.5">
                  {m.citations.map((c, j) => (
                    <Link key={j} to={`/library/${c.resource_id}?passage=${c.passage_id}`} className="inline-flex items-center gap-1 rounded-full border border-beige bg-white px-2.5 py-0.5 text-[11.5px] text-ink-soft hover:text-ink">
                      <BookOpen className="size-3" /> {c.title}{c.page ? `, p. ${c.page}` : ''}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2 text-[11px] text-taupe-deep">
                <span>{fmt(m.created_at, 'MMM d, h:mm a')}</span>
                {m.role === 'user' && <button onClick={() => showContext(m.content)} className="inline-flex items-center gap-1 hover:text-ink cursor-pointer"><Eye className="size-3" /> What the AI would see</button>}
              </div>
              {!aiStatus.chat && lastUserWithoutReply(i) && <p className="mt-1 text-[11.5px] italic text-taupe-deep">Saved. No reply — an AI model isn’t connected.</p>}
            </div>
          ))}
          {sending && <div className="flex items-center gap-2 text-[13px] text-taupe-deep"><Spinner className="size-4" /> {aiStatus.chat ? 'Thinking…' : 'Saving…'}</div>}
          <div ref={endRef} />
        </div>

        <form className="border-t border-beige/70 bg-white/50 p-3 sm:p-4" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
              placeholder={props.placeholder ?? 'Write what’s on your mind…'}
              className="min-h-[52px] flex-1 resize-none border-transparent bg-white"
            />
            <div className="flex flex-col gap-1.5">
              <IconButton label="Preview what the AI would see" type="button" onClick={() => text.trim() && showContext(text)} disabled={!text.trim()}><Eye className="size-4" /></IconButton>
              <button type="submit" aria-label="Send" disabled={!text.trim() || sending} className="flex size-10 items-center justify-center rounded-full bg-ink text-ivory transition hover:bg-[#2c2723] disabled:opacity-40 cursor-pointer">
                <ArrowUp className="size-4" />
              </button>
            </div>
          </div>
        </form>
      </Card>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="What the AI would see" wide>
        {preview && <ContextPreview bundle={preview} />}
      </Modal>
      <RenameModal conv={renaming} onClose={() => setRenaming(null)} onSave={async (title) => {
        if (!renaming) return
        await run(async () => {
          await db.update('conversations', renaming.id, { title })
          threads.setData((l) => l?.map((x) => (x.id === renaming.id ? { ...x, title } : x)))
          setRenaming(null)
        }, 'Renamed')
      }} />
    </div>
  )
}

function RenameModal({ conv, onClose, onSave }: { conv: Conversation | null; onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState('')
  useEffect(() => { setT(conv?.title ?? '') }, [conv])
  return (
    <Modal open={!!conv} onClose={onClose} title="Rename conversation" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => t.trim() && onSave(t.trim())}>Save</Button></>}>
      <input className="h-11 w-full rounded-xl border border-beige bg-white px-3" value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && t.trim() && onSave(t.trim())} />
    </Modal>
  )
}
