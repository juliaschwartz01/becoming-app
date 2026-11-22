import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, PREVIEW_USER_ID } from './db'
import { isPreview } from './config'

interface AuthState {
  loading: boolean
  userId: string | null
  email: string | null
  preview: boolean
  /** True after arriving from a password-reset email link. */
  recovering: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  enterPreview(): void
  finishRecovery(): void
}

const Ctx = createContext<AuthState | null>(null)
let currentUserId: string | null = null
/** The signed-in user's id. Every storage path starts with it (required by storage policies). */
export function requireUserId(): string {
  if (!currentUserId) throw new Error('Please sign in first.')
  return currentUserId
}

const PREVIEW_FLAG = 'becoming-preview:entered'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!isPreview)
  const [previewIn, setPreviewIn] = useState(() => isPreview && safeGet(PREVIEW_FLAG) === '1')
  const [recovering, setRecovering] = useState(() => new URLSearchParams(window.location.search).has('recovery'))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = isPreview ? (previewIn ? PREVIEW_USER_ID : null) : session?.user.id ?? null
  currentUserId = userId

  const value = useMemo<AuthState>(() => ({
    loading,
    userId,
    email: isPreview ? 'preview@this-browser' : session?.user.email ?? null,
    preview: isPreview,
    recovering,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase is not connected yet.')
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message)
    },
    async signOut() {
      if (isPreview) { safeSet(PREVIEW_FLAG, ''); setPreviewIn(false); return }
      await supabase?.auth.signOut()
    },
    async sendPasswordReset(email) {
      if (!supabase) throw new Error('Supabase is not connected yet.')
      const base = window.location.origin + window.location.pathname
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${base}?recovery=1` })
      if (error) throw new Error(error.message)
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Supabase is not connected yet.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
    enterPreview() { safeSet(PREVIEW_FLAG, '1'); setPreviewIn(true) },
    finishRecovery() {
      setRecovering(false)
      const url = new URL(window.location.href)
      url.searchParams.delete('recovery')
      url.searchParams.delete('code')
      window.history.replaceState(null, '', url.pathname + url.search + (url.hash || '#/'))
    },
  }), [loading, userId, session, recovering])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}

function safeGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
