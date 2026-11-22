import type { Reminder } from './types'
import { isoDate } from './utils'

/** Calendar date (local) a reminder starts on. */
export const startDate = (r: Pick<Reminder, 'due_at'>) => isoDate(new Date(r.due_at))

/** Does this reminder occur on the given local date (YYYY-MM-DD)? */
export function occursOn(r: Pick<Reminder, 'due_at' | 'repeat'>, date: string): boolean {
  const start = startDate(r)
  if (date < start) return false
  if (r.repeat === 'none') return date === start
  if (r.repeat === 'daily') return true
  const d = new Date(date + 'T12:00:00')
  const s = new Date(start + 'T12:00:00')
  if (r.repeat === 'weekly') return d.getDay() === s.getDay()
  if (r.repeat === 'monthly') {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return d.getDate() === Math.min(s.getDate(), lastDay)
  }
  return false
}

/** Is it still open (not completed) for that date? */
export function isOpenOn(r: Reminder, date: string): boolean {
  if (r.repeat === 'none') return !r.done
  return r.last_done_on !== date
}

/** Reminders to show on a given day: occurrences that day, plus overdue one-off reminders when date is today. */
export function remindersFor(list: Reminder[], date: string, todayStr = isoDate()): Reminder[] {
  return list
    .filter((r) => (occursOn(r, date) && isOpenOn(r, date)) || (date === todayStr && r.repeat === 'none' && !r.done && startDate(r) < todayStr))
    .sort((a, b) => timeOf(a).localeCompare(timeOf(b)))
}

export const timeOf = (r: Pick<Reminder, 'due_at'>) => {
  const d = new Date(r.due_at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Patch to apply when marking a reminder done for a date. */
export function completionPatch(r: Reminder, date: string): Partial<Reminder> {
  return r.repeat === 'none' ? { done: true, last_done_on: date } : { last_done_on: date }
}
