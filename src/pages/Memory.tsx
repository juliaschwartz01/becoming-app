import { useEffect, useState } from 'react'
import { Check, Download, Lock, Sparkles, X } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import { useProfile } from '../lib/profile'
import type { Memory, Profile } from '../lib/types'
import { MEMORY_CATEGORIES } from '../data/content'
import { exportMemories } from '../lib/account'
import { cx, downloadJSON, fmt } from '../lib/utils'
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Input, Loading, PageHeader, SectionTitle, Select, TagInput, Textarea, Toggle, useAction } from '../components/ui'
import { AddButton, RowActions, useCrud } from '../components/SimpleCrud'

export default function MemoryPage() {
  const { prefs, savePrefs } = useProfile()
  const memories = useData(() => db.list<Memory>('memories', { order: [{ col: 'importance' }, { col: 'updated_at' }] }), [])
  const [cat, setCat] = useState<string | null>(null)
  const crud = useCrud<Memory>('memories', { setData: memories.setData, label: 'Memory', prepare: (f) => (f.id ? f : { ...f, origin: 'user', status: 'verified' }) })
  const { run } = useAction()

  const verified = (memories.data ?? []).filter((m) => m.status === 'verified' && (!cat || m.category === cat))
  const pending = (memories.data ?? []).filter((m) => m.status === 'pending')
  const decide = (m: Memory, status: 'verified' | 'rejected') => run(async () => {
    if (status === 'rejected') { await db.remove('memories', m.id); memories.setData((l) => l?.filter((x) => x.id !== m.id)) }
    else { const row = await db.update<Memory>('memories', m.id, { status }); memories.setData((l) => l?.map((x) => (x.id === m.id ? row : x))) }
  }, status === 'verified' ? 'Memory approved' : 'Suggestion discarded')

  return (
    <>
      <PageHeader eyebrow="Your memory" title="What my AI knows about me" intro="Everything Becoming remembers about you, in one place. You decide what’s kept. Nothing here is ever shared outside your private Supabase project."
        actions={<Button icon={<Download className="size-4" />} onClick={() => run(async () => downloadJSON(await exportMemories(), `becoming-memories-${new Date().toISOString().slice(0, 10)}.json`), 'Memory data exported')}>Export memory data</Button>} />

      <ProfileCard />

      <section className="mt-12">
        <SectionTitle action={<AddButton onClick={() => crud.setEditing({ category: cat ?? 'about-me', importance: 2 })}>Add a memory</AddButton>}>Verified memories</SectionTitle>
        <p className="-mt-2 mb-5 max-w-2xl text-[13.5px] text-ink-soft">Things you’ve chosen to share, written in your words. Only verified memories are ever used — and only the relevant ones for each conversation, never your whole history.</p>
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
          {MEMORY_CATEGORIES.map((c) => <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>)}
        </div>
        {memories.error && <ErrorState message={memories.error} onRetry={memories.reload} />}
        {memories.loading && !memories.data ? <Loading /> : !verified.length ? (
          <EmptyState title="Nothing remembered yet" body="Add the things you’d want a thoughtful friend to know: what you value, how you like to be supported, people who matter, dreams you’re working toward." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {verified.map((m) => (
              <Card key={m.id} className="group p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge>{MEMORY_CATEGORIES.find((c) => c.key === m.category)?.label ?? m.category}</Badge>
                    {m.importance === 3 && <Badge tone="sage">Always relevant</Badge>}
                    {m.origin === 'ai_inferred' && <Badge tone="blush">AI observation · approved</Badge>}
                  </div>
                  <RowActions onEdit={() => crud.setEditing(m)} onDelete={() => crud.remove(m)} />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed">{m.content}</p>
                <p className="mt-2 text-[11.5px] text-taupe-deep">Saved {fmt(m.created_at)}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle>AI observations awaiting approval</SectionTitle>
        <Card className="mb-4 p-5">
          <Toggle
            checked={!!prefs?.memory_suggestions_enabled}
            onChange={(v) => run(() => savePrefs({ memory_suggestions_enabled: v }), v ? 'Memory suggestions on' : 'Memory suggestions off')}
            label="Allow the AI to suggest memories"
            description="When an AI model is connected, it may propose things worth remembering. Suggestions are kept separate and never used until you approve them. Temporary feelings are not turned into permanent traits."
          />
        </Card>
        {!pending.length ? <p className="text-[14px] text-ink-soft">No suggestions waiting.</p> : (
          <ul className="space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-dashed border-blush bg-blush-50/60 p-4">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-blush-deep" />
                <p className="flex-1 text-[14.5px]">{m.content}<span className="block text-[11.5px] text-taupe-deep">Suggested {fmt(m.created_at)}</span></p>
                <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={() => decide(m, 'verified')}>Keep</Button>
                <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => decide(m, 'rejected')}>Discard</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="mt-12 flex gap-3 p-5 text-[13.5px] text-ink-soft">
        <Lock className="mt-0.5 size-4 shrink-0 text-sage-deep" />
        <p>Your memories live in your own Supabase database, protected by Row Level Security. Knowledge Library sources are stored separately and are never mixed with memories about you. No AI provider is connected, so nothing is being sent anywhere.</p>
      </Card>

      {crud.modal('Add a memory', (f, set) => (
        <div className="space-y-4">
          <Field label="What should Becoming remember?" hint="Write it as a lasting fact or preference, not a passing feeling."><Textarea rows={3} value={f.content ?? ''} onChange={(e) => set({ content: e.target.value })} placeholder="I feel most supported when someone asks questions before giving advice." /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><Select value={f.category ?? 'about-me'} onChange={(e) => set({ category: e.target.value })}>{MEMORY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></Field>
            <Field label="Relevance"><Select value={f.importance ?? 2} onChange={(e) => set({ importance: Number(e.target.value) })}><option value={1}>Occasionally relevant</option><option value={2}>Relevant when it comes up</option><option value={3}>Always relevant</option></Select></Field>
          </div>
        </div>
      ), (f) => !!f.content?.trim())}
    </>
  )
}

function ProfileCard() {
  const { profile, saveProfile } = useProfile()
  const [f, setF] = useState<Partial<Profile>>({})
  const { run, busy } = useAction()
  useEffect(() => { if (profile) setF(profile) }, [profile])
  const dirty = JSON.stringify(f) !== JSON.stringify(profile)
  return (
    <Card className="p-6 sm:p-8">
      <SectionTitle>Personal profile</SectionTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Preferred name"><Input value={f.preferred_name ?? ''} onChange={(e) => setF({ ...f, preferred_name: e.target.value })} /></Field>
        <Field label="Communication style" hint="How you like to be spoken to."><Input value={f.communication_style ?? ''} onChange={(e) => setF({ ...f, communication_style: e.target.value })} placeholder="Warm, honest, gently direct" /></Field>
        <Field label="About me" className="md:col-span-2"><Textarea rows={3} value={f.about ?? ''} onChange={(e) => setF({ ...f, about: e.target.value })} /></Field>
        <Field label="Values"><TagInput value={f.personal_values ?? []} onChange={(personal_values) => setF({ ...f, personal_values })} placeholder="freedom, beauty, family…" suggestions={['freedom', 'creativity', 'family', 'growth', 'beauty', 'honesty', 'adventure', 'security']} /></Field>
        <Field label="Current priorities"><TagInput value={f.priorities ?? []} onChange={(priorities) => setF({ ...f, priorities })} placeholder="career, health…" /></Field>
      </div>
      <div className={cx('mt-5 flex items-center gap-3 transition', dirty ? 'opacity-100' : 'opacity-50')}>
        <Button variant="primary" loading={busy} disabled={!dirty} onClick={() => run(() => saveProfile({ preferred_name: f.preferred_name?.trim() || null, communication_style: f.communication_style || null, about: f.about || null, personal_values: f.personal_values ?? [], priorities: f.priorities ?? [] }), 'Profile saved')}>Save profile</Button>
      </div>
    </Card>
  )
}
