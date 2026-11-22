import { describe, expect, it } from 'vitest'
import { chunkText, highlightParts, isoDate, safeFileName, splitLines } from './utils'
import { completionPatch, isOpenOn, occursOn, remindersFor } from './reminders'
import { buildReport, localDate } from './report'
import { arrange } from './board'
import { LocalBackend, type KV } from './db'
import { keywordQuery } from '../ai'
import type { Reminder } from './types'

function memKV(): KV {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
}
const at = (date: string, time = '09:00') => new Date(`${date}T${time}:00`).toISOString()
const reminder = (p: Partial<Reminder>): Reminder => ({ id: 'r', created_at: '', updated_at: '', title: 'x', notes: null, due_at: at('2026-03-10'), repeat: 'none', kind: 'general', goal_id: null, done: false, last_done_on: null, ...p })

describe('utils', () => {
  it('formats local dates', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('makes safe file names', () => {
    expect(safeFileName('My Vision Board!!.PNG')).toBe('My-Vision-Board-.png')
    expect(safeFileName('../../etc/passwd')).not.toContain('/')
  })
  it('splits lines and drops blanks', () => {
    expect(splitLines(' a \n\n b\n')).toEqual(['a', 'b'])
  })
  it('chunks text into passages and keeps page numbers', () => {
    const para = 'Sentence about self concept. '.repeat(40)
    const chunks = chunkText([{ page: 3, text: `${para}\n\n${para}` }, { page: 4, text: 'Short page.' }], 900)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.content.length <= 1500)).toBe(true)
    expect(chunks.at(-1)).toEqual({ page: 4, content: 'Short page.' })
  })
  it('parses highlight markers', () => {
    expect(highlightParts('a <<b>> c')).toEqual([{ text: 'a ', hit: false }, { text: 'b', hit: true }, { text: ' c', hit: false }])
  })
})

describe('reminders', () => {
  it('one-off reminders occur only on their date', () => {
    const r = reminder({})
    expect(occursOn(r, '2026-03-10')).toBe(true)
    expect(occursOn(r, '2026-03-11')).toBe(false)
  })
  it('weekly and monthly repeats', () => {
    expect(occursOn(reminder({ repeat: 'weekly' }), '2026-03-17')).toBe(true)
    expect(occursOn(reminder({ repeat: 'weekly' }), '2026-03-18')).toBe(false)
    expect(occursOn(reminder({ repeat: 'monthly', due_at: at('2026-01-31') }), '2026-02-28')).toBe(true)
    expect(occursOn(reminder({ repeat: 'daily' }), '2026-03-09')).toBe(false)
  })
  it('completion closes only that day for repeating reminders', () => {
    const r = reminder({ repeat: 'daily' })
    const done = { ...r, ...completionPatch(r, '2026-03-12') }
    expect(isOpenOn(done, '2026-03-12')).toBe(false)
    expect(isOpenOn(done, '2026-03-13')).toBe(true)
  })
  it('shows overdue one-off reminders today', () => {
    const list = remindersFor([reminder({ id: 'old', due_at: at('2026-03-01') })], '2026-03-10', '2026-03-10')
    expect(list.map((r) => r.id)).toEqual(['old'])
  })
})

describe('monthly report', () => {
  it('summarizes only the chosen month with real counts', () => {
    const r = buildReport({
      month: '2026-03',
      journal: [
        { id: 'a', title: 'One', entry_date: '2026-03-02', tags: ['growth'], favorite: true, body: 'one two three' },
        { id: 'b', title: null, entry_date: '2026-03-02', tags: ['growth', 'career'], favorite: false, body: 'four' },
        { id: 'c', title: 'Old', entry_date: '2026-02-27', tags: [], favorite: true, body: 'ignored' },
      ],
      moods: [{ mood: 4, label: 'Bright', themes: ['hopeful'], recorded_at: at('2026-03-05', '12:00') }, { mood: 2, label: 'Tender', themes: [], recorded_at: at('2026-03-06', '12:00') }],
      rituals: [{ ritual_date: '2026-03-02', period: 'morning', practice_key: 'gratitude' }],
      practices: [],
      goals: [{ id: 'g', title: 'Move to NYC', status: 'completed', completed_at: at('2026-03-20'), created_at: at('2026-01-01') }],
      achievements: [],
      reflections: [],
      intentions: [],
    })
    expect(r.journal.count).toBe(2)
    expect(r.journal.activeDays).toBe(1)
    expect(r.journal.words).toBe(4)
    expect(r.journal.topTags[0]).toEqual(['growth', 2])
    expect(r.journal.favorites).toHaveLength(1)
    expect(r.mood.average).toBe(3)
    expect(r.goals.completed.map((g) => g.title)).toEqual(['Move to NYC'])
    expect(r.daysInMonth).toBe(31)
  })
  it('localDate passes plain dates through', () => {
    expect(localDate('2026-03-01')).toBe('2026-03-01')
    expect(localDate(null)).toBeNull()
  })
})

describe('vision board layout', () => {
  it('grid layout keeps images inside the board', () => {
    const els = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, type: 'image' as const, x: 0, y: 0, w: 100, h: 100, rotation: 0 }))
    const pos = arrange(els, 'grid', 1600, 1000)
    for (const p of Object.values(pos)) {
      expect(p.x! >= 0 && p.x! + p.w! <= 1600).toBe(true)
      expect(p.y! >= 0 && p.y! + p.h! <= 1000).toBe(true)
    }
  })
})

describe('AI retrieval helpers', () => {
  it('builds keyword queries without filler words', () => {
    expect(keywordQuery('How can I work on my self-concept?')).toBe('work or self or concept')
  })
})

describe('preview data backend', () => {
  it('creates, filters, updates, searches and cascades deletes', async () => {
    const db = new LocalBackend(memKV())
    const res = await db.insert<any>('knowledge_resources', { title: 'Feeling is the Secret', type: 'book' })
    await db.insertMany('knowledge_passages', [
      { resource_id: res.id, passage_index: 0, page_number: 12, content: 'Your self concept shapes how you show up.' },
      { resource_id: res.id, passage_index: 1, page_number: 13, content: 'Gratitude practice each morning.' },
    ])
    const hits = await db.rpc<any[]>('search_passages', { query: 'concept or confidence', match_count: 5 })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ resource_title: 'Feeling is the Secret', page_number: 12 })
    expect(hits[0].snippet).toContain('<<concept>>')

    const g = await db.insert<any>('goals', { title: 'Confidence', status: 'active' })
    await db.update('goals', g.id, { status: 'completed' })
    expect(await db.list('goals', { match: { status: 'active' } })).toHaveLength(0)

    await db.remove('knowledge_resources', res.id)
    expect(await db.list('knowledge_passages', {})).toHaveLength(0)
  })
  it('enforces one ritual completion per practice per day', async () => {
    const db = new LocalBackend(memKV())
    await db.upsert('ritual_completions', { ritual_date: '2026-03-01', period: 'morning', practice_key: 'gratitude', content: 'a' }, 'user_id,ritual_date,period,practice_key')
    await db.upsert('ritual_completions', { ritual_date: '2026-03-01', period: 'morning', practice_key: 'gratitude', content: 'b' }, 'user_id,ritual_date,period,practice_key')
    const rows = await db.list<any>('ritual_completions', {})
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('b')
  })
})
