import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BookMarked, FlaskConical, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useAutosave, useData } from '../../lib/hooks'
import type { Goal, MethodNote, PracticeSession } from '../../lib/types'
import { MANIFESTATION_DISCLAIMER, methodByKey } from '../../data/content'
import { fmt } from '../../lib/utils'
import { Button, Card, EmptyState, Field, IconButton, Input, SaveStatus, Select, Textarea, useAction, useFeedback } from '../../components/ui'

export default function MethodPractice() {
  const { key } = useParams()
  const method = methodByKey(key)
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' } }), [])
  const sessions = useData(() => db.list<PracticeSession>('practices', { match: { method_key: key }, order: [{ col: 'completed_at' }] }), [key])
  const [values, setValues] = useState<Record<string, string>>({})
  const [reflection, setReflection] = useState('')
  const [goalId, setGoalId] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { run, busy } = useAction()
  const { confirm } = useFeedback()

  // Editable notes per method (autosaved)
  const [notes, setNotes] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  useEffect(() => {
    db.list<MethodNote>('method_notes', { match: { method_key: key } }).then((r) => { setNotes(r[0]?.notes ?? ''); setNoteId(r[0]?.id ?? null) }).catch(() => setNotes(''))
  }, [key])
  const noteSave = useAutosave(notes, async (n) => {
    if (n === null) return
    const row = await db.upsert<MethodNote>('method_notes', { ...(noteId ? { id: noteId } : {}), method_key: key!, notes: n }, noteId ? 'id' : 'user_id,method_key')
    setNoteId(row.id)
  }, { enabled: notes !== null })

  if (!method) return <EmptyState title="Practice not found" action={<Link to="/coach/methods"><Button>Back to practices</Button></Link>} />

  const setField = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))
  const hasContent = Object.values(values).some((v) => v.trim()) || reflection.trim()

  const complete = () => run(async () => {
    const row = await db.insert<PracticeSession>('practices', { method_key: method.key, content: values, reflection: reflection.trim() || null, goal_id: goalId || null, completed_at: new Date().toISOString() })
    sessions.setData((l) => [row, ...(l ?? [])])
    setValues({}); setReflection('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, 'Practice saved')

  const saveBelief = () => run(async () => {
    await db.insert('limiting_beliefs', { belief: values.belief, origin: values.origin || null, alternative: values.alternative || null, practice_key: 'limiting-beliefs', reflections: values.against ? [{ id: crypto.randomUUID(), date: new Date().toISOString(), text: `Evidence against: ${values.against}` }] : [] })
  }, 'Saved to your Limiting Beliefs')

  const remove = async (s: PracticeSession) => {
    if (!(await confirm({ title: 'Delete this session?', body: 'This saved practice session will be permanently deleted.', confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await db.remove('practices', s.id); sessions.setData((l) => l?.filter((x) => x.id !== s.id)) }, 'Deleted')
  }

  return (
    <div>
      <Link to="/coach/methods" className="mb-8 inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> All practices</Link>
      <header className="relative mb-10 overflow-hidden rounded-[2rem] px-7 py-10 sm:px-12 grain" style={{ background: method.tone }}>
        <p className="eyebrow mb-3">Manifestation practice</p>
        <h1 className="text-[3rem] leading-none sm:text-[4rem]">{method.title}</h1>
        <p className="mt-3 max-w-xl font-display text-[1.4rem] italic text-ink-soft">{method.subtitle}</p>
        <p className="mt-5 max-w-2xl text-[15px]">{method.explanation}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-3 text-[1.5rem]">Step by step</h2>
            <ol className="space-y-3">
              {method.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14.5px]"><span className="font-display text-xl leading-6 text-blush-deep">{i + 1}</span><span>{s}</span></li>
              ))}
            </ol>
          </Card>
          <Card className="p-6">
            <div className="mb-2 flex items-center gap-2"><FlaskConical className="size-4 text-sage-deep" /><p className="eyebrow">What research says</p></div>
            <p className="text-[14px] text-ink-soft">{method.research}</p>
            <div className="mb-2 mt-5 flex items-center gap-2"><BookMarked className="size-4 text-blush-deep" /><p className="eyebrow">Spiritual tradition</p></div>
            <p className="text-[14px] text-ink-soft">{method.tradition}</p>
            <p className="mt-5 border-t border-beige/70 pt-4 text-[12px] text-taupe-deep">{MANIFESTATION_DISCLAIMER}</p>
          </Card>
          <Card className="p-6">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-[1.5rem]">My notes</h2><SaveStatus state={noteSave.state} error={noteSave.error} /></div>
            <Textarea rows={5} value={notes ?? ''} disabled={notes === null} onChange={(e) => setNotes(e.target.value)} placeholder="What works for you with this practice, variations, reminders…" />
          </Card>
        </div>

        <div>
          <Card className="p-6 sm:p-8">
            <p className="eyebrow mb-1">{fmt(new Date(), 'EEEE, MMMM d')}</p>
            <h2 className="mb-6 text-[1.9rem]">Today’s practice</h2>
            <div className="space-y-5">
              {method.fields.map((f) => f.repeat ? (
                <div key={f.key}>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-soft">{f.label} · {f.repeat} times</p>
                  <div className="space-y-1.5">
                    {Array.from({ length: f.repeat }, (_, i) => (
                      <Input key={i} value={(values[f.key] ?? '').split('\n')[i] ?? ''} placeholder={values.statement || `${i + 1}.`}
                        onChange={(e) => { const lines = (values[f.key] ?? '').split('\n'); while (lines.length < f.repeat!) lines.push(''); lines[i] = e.target.value; setField(f.key, lines.join('\n')) }} />
                    ))}
                  </div>
                </div>
              ) : (
                <Field key={f.key} label={f.label}>
                  {f.rows === 1 ? <Input value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} />
                    : <Textarea rows={f.rows ?? 4} className={f.rows && f.rows > 6 ? 'prose-journal text-[1.15rem]' : ''} value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setField(f.key, e.target.value)} />}
                </Field>
              ))}
              <Field label="Reflection afterwards"><Textarea rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="How did that feel?" /></Field>
              <Field label="Connect to a goal">
                <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  <option value="">None</option>{(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="primary" loading={busy} disabled={!hasContent} onClick={complete}>Complete & save</Button>
                {method.key === 'limiting-beliefs' && <Button variant="secondary" disabled={!values.belief?.trim()} onClick={saveBelief}>Also add to Limiting Beliefs</Button>}
              </div>
            </div>
          </Card>

          <h2 className="mt-10 mb-4 text-[1.6rem]">Past sessions <span className="text-taupe-deep">· {sessions.data?.length ?? 0}</span></h2>
          {!sessions.data?.length ? <p className="text-[14px] text-ink-soft">Completed sessions will be saved here.</p> : (
            <ul className="space-y-2">
              {sessions.data.map((s) => (
                <li key={s.id}>
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex-1 text-left cursor-pointer">
                        <p className="font-display text-lg">{fmt(s.completed_at, 'EEEE, MMMM d, yyyy')}</p>
                        {s.goal_id && <p className="text-[12px] text-taupe-deep">Goal: {goals.data?.find((g) => g.id === s.goal_id)?.title ?? '—'}</p>}
                      </button>
                      <IconButton label="Delete session" className="size-8" onClick={() => remove(s)}><Trash2 className="size-3.5" /></IconButton>
                    </div>
                    {open === s.id && (
                      <div className="mt-3 space-y-3 border-t border-beige/60 pt-3 text-[14px] animate-fade">
                        {method.fields.map((f) => s.content?.[f.key]?.trim() ? <div key={f.key}><p className="eyebrow mb-1">{f.label}</p><p className="whitespace-pre-wrap text-ink-soft">{s.content[f.key]}</p></div> : null)}
                        {s.reflection && <div><p className="eyebrow mb-1">Reflection</p><p className="whitespace-pre-wrap text-ink-soft">{s.reflection}</p></div>}
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
