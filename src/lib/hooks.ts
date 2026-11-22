import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from './db'
import type { Bucket } from './types'

/** Load data with loading/error/retry state. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  loadRef.current = load
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const n = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const d = await loadRef.current()
      if (n === seq.current) setData(d)
    } catch (e) {
      if (n === seq.current) setError((e as Error).message)
    } finally {
      if (n === seq.current) setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, deps)
  return { data, setData, loading, error, reload }
}

/** Resolve a private storage path into a short-lived URL. */
export function useFileUrl(bucket: Bucket, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setUrl(null); setFailed(false)
    if (!path) return
    cachedUrl(bucket, path).then((u) => live && setUrl(u)).catch(() => live && setFailed(true))
    return () => { live = false }
  }, [bucket, path])
  return { url, failed }
}

const urlCache = new Map<string, { url: string; at: number }>()
export async function cachedUrl(bucket: Bucket, path: string) {
  const k = `${bucket}/${path}`
  const hit = urlCache.get(k)
  if (hit && Date.now() - hit.at < 45 * 60 * 1000) return hit.url
  const url = await db.fileUrl(bucket, path, 3600)
  urlCache.set(k, { url, at: Date.now() })
  return url
}

/** Debounced autosave. Returns the save state for a status label. */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, opts: { delay?: number; enabled?: boolean } = {}) {
  const { delay = 1200, enabled = true } = opts
  const [state, setState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const first = useRef(true)
  const saveRef = useRef(save)
  saveRef.current = save
  const latest = useRef(value)
  latest.current = value
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setState('saving')
    try {
      await saveRef.current(latest.current)
      setState('saved'); setError(null)
    } catch (e) {
      setState('error'); setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (!enabled) { first.current = true; return }
    if (first.current) { first.current = false; return }
    setState('pending')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), enabled])

  // Save any pending change when leaving the page.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; saveRef.current(latest.current).catch(() => {}) }
  }, [])

  return { state, error, flush }
}
