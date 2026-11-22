import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from './db'
import { useAuth } from './auth'
import type { Preferences, Profile } from './types'

export const ALL_WIDGETS = [
  { key: 'welcome', label: 'Daily welcome' },
  { key: 'intention', label: 'Intention & affirmation' },
  { key: 'rituals', label: 'Morning & evening rituals' },
  { key: 'reminders', label: 'Today’s reminders' },
  { key: 'shortcuts', label: 'Quick navigation' },
  { key: 'goals', label: 'Active goals' },
  { key: 'mood', label: 'Mood check-in' },
  { key: 'evidence', label: 'From my evidence wall' },
] as const
export const DEFAULT_WIDGETS = ALL_WIDGETS.map((w) => w.key) as string[]

interface ProfileState {
  profile: Profile | null
  prefs: Preferences | null
  loading: boolean
  error: string | null
  reload(): Promise<void>
  saveProfile(patch: Partial<Profile>): Promise<void>
  savePrefs(patch: Partial<Preferences>): Promise<void>
}
const Ctx = createContext<ProfileState | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    try {
      let p = await db.get<Profile>('profiles', userId)
      if (!p) p = await db.upsert<Profile>('profiles', { user_id: userId })
      let pr = await db.get<Preferences>('user_preferences', userId)
      if (!pr) pr = await db.upsert<Preferences>('user_preferences', { user_id: userId, dashboard_widgets: DEFAULT_WIDGETS })
      setProfile({ personal_values: [], priorities: [], ...(p as Partial<Profile>) } as Profile)
      setPrefs({
        dashboard_widgets: DEFAULT_WIDGETS,
        morning_practices: ['gratitude', 'affirmation', 'visualization', 'intention', 'action'],
        evening_practices: ['reflect', 'mood', 'wins', 'gratitude', 'release'],
        affirmations: [],
        memory_suggestions_enabled: false,
        settings: {},
        ...(pr as Partial<Preferences>),
        ...(pr.dashboard_widgets?.length ? {} : { dashboard_widgets: DEFAULT_WIDGETS }),
      } as Preferences)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { reload() }, [reload])

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return
    const row = await db.update<Profile>('profiles', userId, patch)
    setProfile((p) => ({ ...(p as Profile), ...row }))
  }, [userId])
  const savePrefs = useCallback(async (patch: Partial<Preferences>) => {
    if (!userId) return
    const row = await db.update<Preferences>('user_preferences', userId, patch)
    setPrefs((p) => ({ ...(p as Preferences), ...row }))
  }, [userId])

  return <Ctx.Provider value={{ profile, prefs, loading, error, reload, saveProfile, savePrefs }}>{children}</Ctx.Provider>
}

export function useProfile() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile outside provider')
  return v
}
