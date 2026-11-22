import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleDashed, Download, KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/profile'
import { config, isPreview } from '../lib/config'
import { aiStatus } from '../ai'
import { EVENING_PRACTICES, MORNING_PRACTICES, DEFAULT_AFFIRMATIONS } from '../data/content'
import { deleteAllData, exportAllData, exportEverythingZip } from '../lib/account'
import { downloadBlob, downloadJSON, splitLines } from '../lib/utils'
import { Button, Card, Chip, Field, Input, Modal, PageHeader, SectionTitle, Textarea, useAction, useFeedback } from '../components/ui'

export default function Settings() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="Your sanctuary, your way" intro="Account, preferences, reminders, AI connection and your data." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Account />
        <Preferences />
        <AIConnection />
        <DataControls />
      </div>
    </>
  )
}

function Account() {
  const auth = useAuth()
  const { profile, saveProfile } = useProfile()
  const [name, setName] = useState(profile?.preferred_name ?? '')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const { run, busy } = useAction()
  useEffect(() => setName(profile?.preferred_name ?? ''), [profile?.preferred_name])
  const change = () => run(async () => {
    if (pw.length < 10) throw new Error('Please use at least 10 characters.')
    if (pw !== pw2) throw new Error('The two passwords don’t match.')
    await auth.updatePassword(pw); setPw(''); setPw2('')
  }, 'Password changed')
  return (
    <Card className="p-6 sm:p-7">
      <SectionTitle>Account</SectionTitle>
      <p className="text-[14px] text-ink-soft">Signed in as <span className="text-ink">{auth.email}</span></p>
      <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => saveProfile({ preferred_name: name.trim() || null }), 'Name saved') }}>
        <Field label="Preferred name" className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Button type="submit" className="self-end">Save</Button>
      </form>
      <p className="mt-2 text-[12.5px] text-taupe-deep">More about you lives on <Link to="/memory" className="underline decoration-sand underline-offset-2">What my AI knows</Link>.</p>
      {!isPreview && (
        <div className="mt-6 space-y-3 border-t border-beige/70 pt-5">
          <p className="flex items-center gap-2 text-[14px] font-medium"><KeyRound className="size-4" /> Change password</p>
          <Input type="password" autoComplete="new-password" placeholder="New password (10+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Input type="password" autoComplete="new-password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button loading={busy} disabled={!pw || !pw2} onClick={change}>Update password</Button>
        </div>
      )}
      <Button variant="ghost" className="mt-6" icon={<LogOut className="size-4" />} onClick={auth.signOut}>Sign out</Button>
    </Card>
  )
}

function Preferences() {
  const { prefs, savePrefs } = useProfile()
  const { run } = useAction()
  const [aff, setAff] = useState((prefs?.affirmations ?? []).join('\n'))
  useEffect(() => setAff((prefs?.affirmations ?? []).join('\n')), [prefs?.affirmations])
  const toggle = (period: 'morning' | 'evening', key: string) => {
    const field = period === 'morning' ? 'morning_practices' : 'evening_practices'
    const cur = prefs?.[field] ?? []
    run(() => savePrefs({ [field]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }))
  }
  return (
    <Card className="p-6 sm:p-7">
      <SectionTitle>Rituals & reminders</SectionTitle>
      <p className="mb-2 text-[13px] font-medium text-ink-soft">Morning practices</p>
      <div className="mb-4 flex flex-wrap gap-1.5">{MORNING_PRACTICES.map((p) => <Chip key={p.key} active={prefs?.morning_practices.includes(p.key)} onClick={() => toggle('morning', p.key)}>{p.label}</Chip>)}</div>
      <p className="mb-2 text-[13px] font-medium text-ink-soft">Evening practices</p>
      <div className="mb-5 flex flex-wrap gap-1.5">{EVENING_PRACTICES.map((p) => <Chip key={p.key} active={prefs?.evening_practices.includes(p.key)} onClick={() => toggle('evening', p.key)}>{p.label}</Chip>)}</div>
      <Field label="My daily affirmations" hint={`One per line. One is shown on Home each day. Leave empty to use Becoming’s ${DEFAULT_AFFIRMATIONS.length} defaults.`}>
        <Textarea rows={5} value={aff} onChange={(e) => setAff(e.target.value)} />
      </Field>
      <Button size="sm" className="mt-2" onClick={() => run(() => savePrefs({ affirmations: splitLines(aff) }), 'Affirmations saved')}>Save affirmations</Button>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-beige/70 pt-5 text-[13.5px]">
        <Link to="/reminders"><Button size="sm" variant="ghost">Reminder calendar →</Button></Link>
        <Link to="/rituals"><Button size="sm" variant="ghost">Ritual history →</Button></Link>
        <Link to="/"><Button size="sm" variant="ghost">Customize Home →</Button></Link>
      </div>
      <p className="mt-3 text-[12px] text-taupe-deep">Reminders are shown inside the app. Email and push notifications would need an extra service, so they aren’t offered.</p>
    </Card>
  )
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage-deep" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-taupe" />}
      <div><p className="text-[14.5px]">{label} <span className="text-[12px] text-taupe-deep">· {ok ? 'working' : 'not connected'}</span></p><p className="text-[12.5px] text-ink-soft">{detail}</p></div>
    </li>
  )
}

function AIConnection() {
  return (
    <Card className="p-6 sm:p-7">
      <SectionTitle>Connections</SectionTitle>
      <ul className="divide-y divide-beige/60">
        <Status ok={config.cloud} label="Supabase cloud" detail={config.cloud ? 'Your data is saved to your private Supabase project and synced across devices.' : 'Preview mode — data stays in this browser until Supabase is connected (see README).'} />
        <Status ok={config.cloud} label="Memory & knowledge retrieval" detail="Finds relevant memories, goals, evidence and library passages for each conversation. Works without an AI model." />
        <Status ok={aiStatus.chat} label="Conversational AI" detail="Powers the confidante, coach, Future Me, Ask my library and AI plans. Needs an approved AI provider." />
        <Status ok={aiStatus.image} label="Image generation" detail="Creates vision-board visualizations. Needs an approved image model." />
        <Status ok={aiStatus.transcription} label="Transcription" detail="Turns uploaded audio/video into searchable text. Needs a transcription service." />
      </ul>
      <div className="mt-4 rounded-2xl bg-linen/60 p-4 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">How AI would be connected</p>
        <p className="mt-1">Becoming has everything ready except the AI model itself, which is a separate (usually paid) service. Nothing has been added without your permission. When you choose a provider, its key is stored as a secret inside Supabase Edge Functions — never in this website or on GitHub. Step-by-step instructions are in the project’s CLAUDE.md.</p>
      </div>
    </Card>
  )
}

function DataControls() {
  const { toast } = useFeedback()
  const { reload } = useProfile()
  const [progress, setProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const stamp = new Date().toISOString().slice(0, 10)
  const go = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); toast(ok) } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false); setProgress(null) }
  }
  return (
    <Card className="p-6 sm:p-7">
      <SectionTitle>Your data</SectionTitle>
      <p className="text-[14px] text-ink-soft">Everything is yours. Export it at any time.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Download className="size-4" />} disabled={busy} onClick={() => go(async () => downloadJSON(await exportAllData(setProgress), `becoming-data-${stamp}.json`), 'Data exported')}>Export data (.json)</Button>
        <Button icon={<Download className="size-4" />} disabled={busy} onClick={() => go(async () => downloadBlob(await exportEverythingZip(setProgress), `becoming-everything-${stamp}.zip`), 'Export ready')}>Export everything with files (.zip)</Button>
      </div>
      {progress && <p className="mt-3 text-[12.5px] text-taupe-deep">{progress}</p>}
      <p className="mt-3 text-[12px] text-taupe-deep">Keep exports somewhere private — never add them to the GitHub project folder.</p>

      <div className="mt-8 rounded-2xl border border-[#ead2cb] bg-[#fbf3f0] p-5">
        <p className="flex items-center gap-2 text-[14.5px] font-medium text-[#7d4339]"><AlertTriangle className="size-4" /> Delete all my data</p>
        <p className="mt-1 text-[13px] text-[#7d4339]/80">Permanently deletes every journal entry, conversation, memory, goal, board, image, document and file. Your login remains (remove it in Supabase → Authentication → Users). Export first if you might want anything back.</p>
        <Button variant="danger" className="mt-3" onClick={() => { setTyped(''); setDeleteOpen(true) }}>Delete all data…</Button>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete everything?" footer={<>
        <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
        <Button variant="danger" loading={busy} disabled={typed !== 'DELETE'} onClick={() => go(async () => { await deleteAllData(setProgress); setDeleteOpen(false); await reload() }, 'All data deleted')}>Permanently delete</Button>
      </>}>
        <p className="text-[14.5px] text-ink-soft">This cannot be undone. Type <strong className="text-ink">DELETE</strong> to confirm.</p>
        <Input className="mt-3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
        {progress && <p className="mt-3 text-[12.5px] text-taupe-deep">{progress}</p>}
      </Modal>
    </Card>
  )
}
