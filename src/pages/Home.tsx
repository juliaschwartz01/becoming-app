import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, Check, Feather, Image as ImageIcon, LayoutGrid, MessageCircle, Sparkles, Sun } from 'lucide-react'
import { useProfile, ALL_WIDGETS } from '../lib/profile'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import type { Achievement, Goal, MoodEntry, Reminder } from '../lib/types'
import { DEFAULT_AFFIRMATIONS, MOODS, REFLECTION_PROMPTS, categoryLabel } from '../data/content'
import { completionPatch, remindersFor, startDate, timeOf } from '../lib/reminders'
import { cx, dayOfYear, fmt, greeting, pick, today } from '../lib/utils'
import { Button, Card, Input, Modal, Spinner, Toggle, useAction } from '../components/ui'
import RitualsWidget from '../components/Rituals'

export default function Home() {
  const { prefs, savePrefs } = useProfile()
  const [customizing, setCustomizing] = useState(false)
  const widgets = prefs?.dashboard_widgets ?? []

  const render = (key: string) => {
    switch (key) {
      case 'welcome': return <Welcome key={key} />
      case 'intention': return <Intention key={key} />
      case 'rituals': return <RitualsWidget key={key} />
      case 'reminders': return <TodayReminders key={key} />
      case 'shortcuts': return <Shortcuts key={key} />
      case 'goals': return <ActiveGoals key={key} />
      case 'mood': return <QuickMood key={key} />
      case 'evidence': return <EvidenceMoment key={key} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" icon={<LayoutGrid className="size-3.5" />} onClick={() => setCustomizing(true)}>Customize</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {widgets.map((w) => (
          <div key={w} className={cx('animate-rise', ['welcome', 'shortcuts'].includes(w) && 'lg:col-span-2')}>{render(w)}</div>
        ))}
      </div>
      <CustomizeModal open={customizing} onClose={() => setCustomizing(false)} value={widgets} onSave={(v) => savePrefs({ dashboard_widgets: v })} />
    </div>
  )
}

function Welcome() {
  const { profile, prefs } = useProfile()
  const seed = dayOfYear()
  const affirmations = prefs?.affirmations?.length ? prefs.affirmations : DEFAULT_AFFIRMATIONS
  const [promptOffset, setPromptOffset] = useState(0)
  const prompt = pick(REFLECTION_PROMPTS, seed + promptOffset)
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-linen px-7 py-10 sm:px-12 sm:py-14 grain">
      <div className="absolute -right-24 -top-24 size-[22rem] rounded-full bg-blush-100/80 blur-2xl" />
      <div className="absolute -bottom-32 right-40 size-[18rem] rounded-full bg-sage-100/90 blur-2xl" />
      <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow mb-4">{fmt(new Date(), 'EEEE · MMMM d, yyyy')}</p>
          <h1 className="text-[3rem] leading-[1] sm:text-[4.2rem]">
            {greeting()},<br />
            <span className="italic">{profile?.preferred_name || 'beautiful'}</span>.
          </h1>
          {!profile?.preferred_name && <Link to="/settings" className="mt-3 inline-block text-[13px] text-ink-soft underline decoration-sand underline-offset-4">Tell Becoming what to call you</Link>}
          <p className="mt-8 max-w-lg font-display text-[1.55rem] leading-snug italic text-ink">“{pick(affirmations, seed)}”</p>
          <p className="mt-2 eyebrow">Today’s affirmation</p>
        </div>
        <div className="rounded-3xl bg-ivory/70 p-6 backdrop-blur-sm">
          <p className="eyebrow mb-2">Reflect</p>
          <p className="font-display text-[1.35rem] leading-snug">{prompt}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/inner-world/journal/new?prompt=${encodeURIComponent(prompt)}`}><Button size="sm" variant="primary" icon={<Feather className="size-3.5" />}>Write about it</Button></Link>
            <Button size="sm" variant="ghost" onClick={() => setPromptOffset((o) => o + 1)}>Another prompt</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Intention() {
  const { profile, saveProfile } = useProfile()
  const isToday = profile?.intention_date === today()
  const [text, setText] = useState(isToday ? profile?.daily_intention ?? '' : '')
  const [editing, setEditing] = useState(!isToday || !profile?.daily_intention)
  const { run, busy } = useAction()
  useEffect(() => { if (isToday) setText(profile?.daily_intention ?? '') }, [isToday, profile?.daily_intention])
  const save = () => run(async () => { await saveProfile({ daily_intention: text.trim(), intention_date: today() }); setEditing(false) }, 'Intention saved')

  return (
    <Card className="flex h-full flex-col p-6 sm:p-7">
      <p className="eyebrow mb-1">Personal intention</p>
      <h2 className="mb-4 text-[1.7rem] leading-tight">How I want to move through today</h2>
      {editing ? (
        <form className="mt-auto flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); text.trim() && save() }}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Today, I choose to…" />
          <Button variant="primary" loading={busy} type="submit" disabled={!text.trim()}>Set</Button>
        </form>
      ) : (
        <div className="mt-auto">
          <p className="font-display text-[1.6rem] italic leading-snug">{profile?.daily_intention}</p>
          <button className="mt-3 text-[13px] text-ink-soft underline decoration-sand underline-offset-4 cursor-pointer" onClick={() => setEditing(true)}>Change</button>
        </div>
      )}
    </Card>
  )
}

function TodayReminders() {
  const date = today()
  const list = useData(() => db.list<Reminder>('reminders', { order: [{ col: 'due_at', asc: true }] }), [])
  const { run } = useAction()
  const items = remindersFor(list.data ?? [], date)
  const done = (r: Reminder) => run(async () => {
    const row = await db.update<Reminder>('reminders', r.id, completionPatch(r, date))
    list.setData((l) => l?.map((x) => (x.id === r.id ? row : x)))
  }, 'Nicely done')
  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <div><p className="eyebrow mb-1">Reminders</p><h2 className="text-[1.7rem] leading-tight">For today</h2></div>
        <Link to="/reminders" className="text-[13px] text-ink-soft hover:text-ink">Calendar →</Link>
      </div>
      {list.loading && !list.data ? <Spinner /> : list.error ? <p className="text-[13px] text-[#9a4a3f]">{list.error}</p> : items.length === 0 ? (
        <p className="text-[14px] text-ink-soft">Nothing scheduled. <Link to="/reminders" className="underline decoration-sand underline-offset-4">Add a gentle reminder</Link>.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3">
              <button aria-label="Mark done" onClick={() => done(r)} className="flex size-6 shrink-0 items-center justify-center rounded-full border border-sand hover:border-sage hover:bg-sage-50 cursor-pointer"><Check className="size-3 text-transparent hover:text-sage-deep" /></button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{r.title}</p>
                <p className="text-[12px] text-taupe-deep">{timeOf(r)}{r.repeat !== 'none' ? ` · ${r.repeat}` : ''}{startDate(r) < date && r.repeat === 'none' ? ' · overdue' : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[11.5px] text-taupe-deep">Reminders appear here inside the app. Email and push notifications aren’t available with the current setup.</p>
    </Card>
  )
}

function Shortcuts() {
  const items = [
    { to: '/inner-world/journal', label: 'My Journal', sub: 'Write freely', icon: Feather, tone: '#efe2d6' },
    { to: '/coach/chat', label: 'Manifestation Coach', sub: 'Practices & plans', icon: Sparkles, tone: '#e1e7d9' },
    { to: '/envision', label: 'Vision Board Studio', sub: 'See it clearly', icon: ImageIcon, tone: '#f1dfd8' },
    { to: '/becoming/future', label: 'Future Self', sub: 'Talk with them', icon: MessageCircle, tone: '#e9e0ea' },
    { to: '/library', label: 'Knowledge Library', sub: 'Your teachings', icon: BookOpen, tone: '#e6dac8' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ to, label, sub, icon: Icon, tone }) => (
        <Link key={to} to={to} className="group relative overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift" style={{ background: tone }}>
          <Icon className="size-5 text-ink-soft" strokeWidth={1.4} />
          <p className="mt-10 font-display text-[1.3rem] leading-tight">{label}</p>
          <p className="text-[12px] text-ink-soft">{sub}</p>
          <ArrowRight className="absolute right-4 top-5 size-4 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-60" />
        </Link>
      ))}
    </div>
  )
}

function ActiveGoals() {
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' }, order: [{ col: 'updated_at' }], limit: 5 }), [])
  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-4 flex items-baseline justify-between">
        <div><p className="eyebrow mb-1">Manifesting</p><h2 className="text-[1.7rem] leading-tight">Active goals</h2></div>
        <Link to="/coach/goals" className="text-[13px] text-ink-soft hover:text-ink">All goals →</Link>
      </div>
      {goals.loading && !goals.data ? <Spinner /> : !goals.data?.length ? (
        <p className="text-[14px] text-ink-soft">No goals yet. <Link to="/coach/goals" className="underline decoration-sand underline-offset-4">Name something you’re calling in</Link>.</p>
      ) : (
        <ul className="space-y-2">
          {goals.data.map((g) => (
            <li key={g.id}><Link to={`/coach/goals/${g.id}`} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 hover:bg-white">
              <span className="truncate">{g.title}</span><span className="ml-3 shrink-0 text-[12px] text-taupe-deep">{categoryLabel(g.category)}</span>
            </Link></li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function QuickMood() {
  const recent = useData(() => db.list<MoodEntry>('mood_entries', { order: [{ col: 'recorded_at' }], limit: 1 }), [])
  const { run, busy } = useAction()
  const [chosen, setChosen] = useState<number | null>(null)
  const [context, setContext] = useState('')
  const save = () => run(async () => {
    const m = MOODS.find((x) => x.value === chosen)!
    const row = await db.insert<MoodEntry>('mood_entries', { mood: m.value, label: m.label, context: context.trim() || null, recorded_at: new Date().toISOString() })
    recent.setData([row]); setChosen(null); setContext('')
  }, 'Mood recorded')
  const last = recent.data?.[0]
  return (
    <Card className="p-6 sm:p-7">
      <p className="eyebrow mb-1">Check in</p>
      <h2 className="mb-4 text-[1.7rem] leading-tight">How are you feeling?</h2>
      <div className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button key={m.value} onClick={() => setChosen(m.value)} className={cx('rounded-2xl px-1 py-3 text-center text-[12.5px] transition cursor-pointer', chosen === m.value ? 'ring-2 ring-ink' : 'hover:-translate-y-0.5')} style={{ background: m.tone }}>
            {m.label}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="mt-3 flex gap-2 animate-rise">
          <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="A few words of context (optional)" />
          <Button variant="primary" loading={busy} onClick={save}>Save</Button>
        </div>
      )}
      <p className="mt-4 text-[12.5px] text-taupe-deep">
        {last ? <>Last check-in: <span className="text-ink-soft">{last.label}</span> · {fmt(last.recorded_at, 'MMM d, h:mm a')}</> : 'No check-ins yet.'}{' '}
        <Link to="/inner-world/mood" className="underline decoration-sand underline-offset-4">History</Link>
      </p>
    </Card>
  )
}

function EvidenceMoment() {
  const ev = useData(() => db.list<Achievement>('achievements', { order: [{ col: 'occurred_on' }], limit: 30 }), [])
  const item = ev.data?.length ? ev.data[dayOfYear() % ev.data.length] : null
  return (
    <Card className="relative overflow-hidden bg-blush-50/80 p-6 sm:p-7">
      <Sun className="absolute -right-6 -top-6 size-32 text-blush-100" strokeWidth={0.8} />
      <p className="eyebrow mb-1">From your evidence wall</p>
      {item ? (
        <>
          <h2 className="mt-2 text-[1.8rem] leading-tight">{item.title}</h2>
          {item.description && <p className="mt-2 line-clamp-3 text-[14.5px] text-ink-soft">{item.description}</p>}
          <p className="mt-3 text-[12px] text-taupe-deep">{fmt(item.occurred_on)}</p>
        </>
      ) : (
        <p className="mt-2 text-[14px] text-ink-soft">Your proof that you can will gather here. <Link to="/becoming/evidence" className="underline decoration-sand underline-offset-4">Add your first piece of evidence</Link>.</p>
      )}
    </Card>
  )
}

function CustomizeModal({ open, onClose, value, onSave }: { open: boolean; onClose: () => void; value: string[]; onSave: (v: string[]) => Promise<void> }) {
  const [list, setList] = useState<string[]>(value)
  const { run, busy } = useAction()
  useEffect(() => { if (open) setList(value) }, [open, value])
  const order = [...list, ...ALL_WIDGETS.map((w) => w.key).filter((k) => !list.includes(k))]
  const move = (k: string, d: -1 | 1) => {
    const i = list.indexOf(k)
    const j = i + d
    if (i < 0 || j < 0 || j >= list.length) return
    const next = [...list];[next[i], next[j]] = [next[j], next[i]]; setList(next)
  }
  return (
    <Modal open={open} onClose={onClose} title="Customize your home" footer={<>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="primary" loading={busy} onClick={() => run(async () => { await onSave(list); onClose() }, 'Home updated')}>Save</Button>
    </>}>
      <ul className="divide-y divide-beige/60">
        {order.map((k) => {
          const w = ALL_WIDGETS.find((x) => x.key === k)!
          const on = list.includes(k)
          return (
            <li key={k} className="flex items-center gap-2">
              <div className="flex-1"><Toggle checked={on} label={w.label} onChange={(v) => setList(v ? [...list, k] : list.filter((x) => x !== k))} /></div>
              <button aria-label="Move up" disabled={!on} onClick={() => move(k, -1)} className="rounded-full p-1.5 text-taupe-deep hover:bg-linen disabled:opacity-30 cursor-pointer"><ArrowUp className="size-4" /></button>
              <button aria-label="Move down" disabled={!on} onClick={() => move(k, 1)} className="rounded-full p-1.5 text-taupe-deep hover:bg-linen disabled:opacity-30 cursor-pointer"><ArrowDown className="size-4" /></button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
