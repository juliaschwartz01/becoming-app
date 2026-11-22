import { useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/hooks'
import type { Goal, Reminder } from '../lib/types'
import { completionPatch, isOpenOn, occursOn, timeOf } from '../lib/reminders'
import { cx, fmt, isoDate, today } from '../lib/utils'
import { Button, Card, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, Select, Textarea, useAction, useFeedback } from '../components/ui'

export default function Reminders() {
  const list = useData(() => db.list<Reminder>('reminders', { order: [{ col: 'due_at', asc: true }] }), [])
  const goals = useData(() => db.list<Goal>('goals', { match: { status: 'active' } }), [])
  const [month, setMonth] = useState(new Date())
  const [selected, setSelected] = useState(today())
  const [editing, setEditing] = useState<Partial<Reminder> | null>(null)
  const { run } = useAction()
  const { confirm } = useFeedback()

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const items = list.data ?? []
  const onDay = (d: string) => items.filter((r) => occursOn(r, d))

  const toggle = (r: Reminder, date: string) => run(async () => {
    const open = isOpenOn(r, date)
    const patch = open ? completionPatch(r, date) : r.repeat === 'none' ? { done: false, last_done_on: null } : { last_done_on: null }
    const row = await db.update<Reminder>('reminders', r.id, patch)
    list.setData((l) => l?.map((x) => (x.id === r.id ? row : x)))
  })
  const remove = async (r: Reminder) => {
    if (!(await confirm({ title: 'Delete reminder?', body: `“${r.title}” will be permanently removed.`, confirmLabel: 'Delete', danger: true }))) return
    run(async () => { await db.remove('reminders', r.id); list.setData((l) => l?.filter((x) => x.id !== r.id)) }, 'Reminder deleted')
  }

  return (
    <>
      <PageHeader eyebrow="Home" title="Reminders" intro="Gentle in-app reminders tied to your goals, rituals and reflections. They appear on your Home page on the right day."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing({ due_at: `${selected}T09:00`, repeat: 'none', kind: 'general' })}>New reminder</Button>} />
      {list.error && <ErrorState message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? <Loading /> : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl">{fmt(month, 'MMMM yyyy')}</h2>
              <div className="flex gap-1">
                <IconButton label="Previous month" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="size-4" /></IconButton>
                <IconButton label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4" /></IconButton>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-taupe-deep">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const iso = isoDate(d)
                const n = onDay(iso).length
                const inMonth = d.getMonth() === month.getMonth()
                return (
                  <button key={iso} onClick={() => setSelected(iso)} className={cx(
                    'flex aspect-square flex-col items-center justify-center rounded-xl text-[13.5px] transition cursor-pointer',
                    iso === selected ? 'bg-ink text-ivory' : iso === today() ? 'bg-sage-100' : 'hover:bg-linen',
                    !inMonth && 'opacity-40',
                  )}>
                    {d.getDate()}
                    {n > 0 && <span className={cx('mt-0.5 size-1.5 rounded-full', iso === selected ? 'bg-ivory' : 'bg-blush-deep')} />}
                  </button>
                )
              })}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="eyebrow mb-1">{selected === today() ? 'Today' : fmt(selected, 'EEEE')}</p>
            <h2 className="mb-4 text-2xl">{fmt(selected, 'MMMM d')}</h2>
            <ul className="space-y-2">
              {onDay(selected).map((r) => {
                const open = isOpenOn(r, selected)
                return (
                  <li key={r.id} className="group flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3">
                    <button aria-label={open ? 'Mark done' : 'Mark not done'} onClick={() => toggle(r, selected)} className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border cursor-pointer', open ? 'border-sand' : 'border-sage-deep bg-sage-deep text-white')}>
                      {!open && <Check className="size-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cx('text-[15px]', !open && 'line-through text-ink-soft')}>{r.title}</p>
                      <p className="text-[12px] text-taupe-deep">{timeOf(r)} · {r.repeat === 'none' ? 'once' : r.repeat}{r.goal_id ? ` · ${goals.data?.find((g) => g.id === r.goal_id)?.title ?? 'goal'}` : ''}</p>
                      {r.notes && <p className="mt-1 text-[13px] text-ink-soft">{r.notes}</p>}
                    </div>
                    <IconButton label="Edit" className="size-8" onClick={() => setEditing(r)}><Pencil className="size-3.5" /></IconButton>
                    <IconButton label="Delete" className="size-8" onClick={() => remove(r)}><Trash2 className="size-3.5" /></IconButton>
                  </li>
                )
              })}
              {onDay(selected).length === 0 && <p className="text-[14px] text-ink-soft">Nothing on this day.</p>}
            </ul>
            <p className="mt-5 text-[11.5px] text-taupe-deep">In-app only: reminders show inside Becoming. Email or push notifications would need an extra service, so they aren’t offered.</p>
          </Card>
        </div>
      )}
      <ReminderModal value={editing} goals={goals.data ?? []} onClose={() => setEditing(null)} onSaved={(row) => {
        list.setData((l) => { const rest = (l ?? []).filter((x) => x.id !== row.id); return [...rest, row].sort((a, b) => a.due_at.localeCompare(b.due_at)) })
        setEditing(null)
      }} />
    </>
  )
}

function toLocalInput(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  return `${isoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function ReminderModal({ value, goals, onClose, onSaved }: { value: Partial<Reminder> | null; goals: Goal[]; onClose: () => void; onSaved: (r: Reminder) => void }) {
  const [form, setForm] = useState<Partial<Reminder>>({})
  const { run, busy } = useAction()
  const [lastValue, setLastValue] = useState<Partial<Reminder> | null>(null)
  if (value !== lastValue) { setLastValue(value); setForm(value ? { ...value, due_at: toLocalInput(value.due_at ?? `${today()}T09:00`) } : {}) }
  const set = (p: Partial<Reminder>) => setForm((f) => ({ ...f, ...p }))
  const save = () => run(async () => {
    const payload = { title: form.title!.trim(), notes: form.notes || null, due_at: new Date(form.due_at!).toISOString(), repeat: form.repeat ?? 'none', kind: form.kind ?? 'general', goal_id: form.goal_id || null }
    const row = value?.id ? await db.update<Reminder>('reminders', value.id, payload) : await db.insert<Reminder>('reminders', payload)
    onSaved(row)
  }, 'Reminder saved')
  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? 'Edit reminder' : 'New reminder'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!form.title?.trim() || !form.due_at} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Reminder"><Input value={form.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Evening visualization" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date & time"><Input type="datetime-local" value={form.due_at ?? ''} onChange={(e) => set({ due_at: e.target.value })} /></Field>
          <Field label="Repeats">
            <Select value={form.repeat ?? 'none'} onChange={(e) => set({ repeat: e.target.value as Reminder['repeat'] })}>
              <option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.kind ?? 'general'} onChange={(e) => set({ kind: e.target.value })}>
              <option value="general">General</option><option value="goal">Goal</option><option value="ritual">Ritual</option><option value="reflection">Reflection</option>
            </Select>
          </Field>
          <Field label="Linked goal">
            <Select value={form.goal_id ?? ''} onChange={(e) => set({ goal_id: e.target.value || null })}>
              <option value="">None</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
