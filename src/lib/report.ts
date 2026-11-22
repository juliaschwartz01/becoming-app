// Monthly Becoming Report — built only from records you actually saved.
// Deterministic: no AI, no interpretation, just counts, averages and your own words.

import type { Achievement, Goal, JournalEntry, MoodEntry, PracticeSession, Reflection, RitualCompletion } from './types'
import { MOODS } from '../data/content'

export interface ReportInput {
  month: string // YYYY-MM
  journal: Pick<JournalEntry, 'id' | 'title' | 'entry_date' | 'tags' | 'favorite' | 'body'>[]
  moods: Pick<MoodEntry, 'mood' | 'label' | 'themes' | 'recorded_at'>[]
  rituals: Pick<RitualCompletion, 'ritual_date' | 'period' | 'practice_key'>[]
  practices: Pick<PracticeSession, 'method_key' | 'completed_at'>[]
  goals: Pick<Goal, 'id' | 'title' | 'status' | 'completed_at' | 'created_at'>[]
  achievements: Pick<Achievement, 'id' | 'title' | 'kind' | 'occurred_on'>[]
  reflections: Pick<Reflection, 'id' | 'title' | 'kind' | 'created_at'>[]
  intentions: string[]
}

export interface Report {
  month: string
  daysInMonth: number
  journal: { count: number; activeDays: number; words: number; topTags: [string, number][]; favorites: { id: string; title: string; date: string }[] }
  mood: { count: number; average: number | null; distribution: { label: string; count: number }[]; topThemes: [string, number][] }
  rituals: { total: number; morning: number; evening: number; activeDays: number; byPractice: [string, number][] }
  practices: { total: number; byMethod: [string, number][] }
  goals: { completed: { id: string; title: string }[]; created: number; active: number }
  achievements: { id: string; title: string; kind: string; date: string }[]
  reflections: { id: string; title: string }[]
  intentions: string[]
}

const inMonth = (iso: string | null | undefined, month: string) => !!iso && iso.slice(0, 7) === month
const top = (items: string[], n = 6): [string, number][] => {
  const m = new Map<string, number>()
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1)
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
}
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0)

export function buildReport(input: ReportInput): Report {
  const { month } = input
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const journal = input.journal.filter((j) => inMonth(j.entry_date, month))
  const moods = input.moods.filter((x) => inMonth(localDate(x.recorded_at), month))
  const rituals = input.rituals.filter((r) => inMonth(r.ritual_date, month))
  const practices = input.practices.filter((p) => inMonth(localDate(p.completed_at), month))
  const avg = moods.length ? Math.round((moods.reduce((s, x) => s + x.mood, 0) / moods.length) * 10) / 10 : null

  return {
    month,
    daysInMonth,
    journal: {
      count: journal.length,
      activeDays: new Set(journal.map((j) => j.entry_date)).size,
      words: journal.reduce((s, j) => s + wordCount(j.body ?? ''), 0),
      topTags: top(journal.flatMap((j) => j.tags ?? [])),
      favorites: journal.filter((j) => j.favorite).map((j) => ({ id: j.id, title: j.title || 'Untitled', date: j.entry_date })),
    },
    mood: {
      count: moods.length,
      average: avg,
      distribution: MOODS.map((md) => ({ label: md.label, count: moods.filter((x) => x.mood === md.value).length })),
      topThemes: top(moods.flatMap((x) => x.themes ?? [])),
    },
    rituals: {
      total: rituals.length,
      morning: rituals.filter((r) => r.period === 'morning').length,
      evening: rituals.filter((r) => r.period === 'evening').length,
      activeDays: new Set(rituals.map((r) => r.ritual_date)).size,
      byPractice: top(rituals.map((r) => `${r.period}:${r.practice_key}`), 10),
    },
    practices: { total: practices.length, byMethod: top(practices.map((p) => p.method_key), 10) },
    goals: {
      completed: input.goals.filter((g) => g.status === 'completed' && inMonth(localDate(g.completed_at), month)).map((g) => ({ id: g.id, title: g.title })),
      created: input.goals.filter((g) => inMonth(localDate(g.created_at), month)).length,
      active: input.goals.filter((g) => g.status === 'active').length,
    },
    achievements: input.achievements.filter((a) => inMonth(a.occurred_on, month)).map((a) => ({ id: a.id, title: a.title, kind: a.kind, date: a.occurred_on })),
    reflections: input.reflections.filter((r) => inMonth(localDate(r.created_at), month)).map((r) => ({ id: r.id, title: r.title })),
    intentions: input.intentions,
  }
}

/** Convert a timestamp to the local calendar date (YYYY-MM-DD). Plain dates pass through. */
export function localDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
