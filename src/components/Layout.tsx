import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Brain, Compass, Feather, Home, LogOut, Menu, Settings, Sparkles, Sprout, X, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/profile'
import { cx } from '../lib/utils'
import { isPreview } from '../lib/config'

export const NAV = [
  { to: '/', label: 'Home', sub: 'My sanctuary', icon: Home, end: true },
  { to: '/envision', label: 'Envision', sub: 'Vision board studio', icon: ImageIcon },
  { to: '/inner-world', label: 'Inner World', sub: 'Journal & confidante', icon: Feather },
  { to: '/coach', label: 'Manifestation Coach', sub: 'Practices & plans', icon: Sparkles },
  { to: '/library', label: 'Knowledge Library', sub: 'Books, notes & teachings', icon: BookOpen },
  { to: '/becoming', label: 'Becoming', sub: 'My personal evolution', icon: Sprout },
]
const SECONDARY = [
  { to: '/memory', label: 'What my AI knows', icon: Brain },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M16 4c-4 5-4 19 0 24 4-5 4-19 0-24Z" fill="none" stroke="#64725a" strokeWidth="1.3" />
        <path d="M16 28c-5-2-9-7-10-13 5 1 9 5 10 13Zm0 0c5-2 9-7 10-13-5 1-9 5-10 13Z" fill="none" stroke="#b48678" strokeWidth="1.1" />
      </svg>
      <span className="font-display text-[1.7rem] leading-none tracking-tight">Becoming</span>
    </div>
  )
}

export default function Layout() {
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }) }, [loc.pathname])

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-8"><Wordmark /></div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, sub, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx(
              'group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition',
              isActive ? 'bg-white/80 shadow-soft text-ink' : 'text-ink-soft hover:bg-white/50 hover:text-ink',
            )}
          >
            {({ isActive }) => (<>
              <span className={cx('flex size-9 items-center justify-center rounded-xl transition', isActive ? 'bg-sage-100 text-sage-deep' : 'bg-transparent text-taupe-deep group-hover:text-ink')}>
                <Icon className="size-[18px]" strokeWidth={1.5} />
              </span>
              <span className="leading-tight">
                <span className="block text-[14px] font-medium">{label}</span>
                <span className="block text-[11.5px] text-taupe-deep">{sub}</span>
              </span>
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 space-y-0.5 border-t border-beige/70 px-3 pt-4 pb-5">
        {SECONDARY.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition', isActive ? 'bg-white/80 text-ink' : 'text-ink-soft hover:text-ink hover:bg-white/50')}>
            <Icon className="size-4" strokeWidth={1.5} /> {label}
          </NavLink>
        ))}
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-ink-soft transition hover:bg-white/50 hover:text-ink cursor-pointer">
          <LogOut className="size-4" strokeWidth={1.5} /> Sign out
        </button>
        {profile?.preferred_name && <p className="px-3 pt-3 font-display text-[15px] italic text-taupe-deep">for {profile.preferred_name}</p>}
      </div>
    </div>
  )

  return (
    <div className="paper min-h-dvh">
      {isPreview && (
        <div className="sticky top-0 z-40 print:hidden bg-blush-100/95 px-4 py-1.5 text-center text-[12.5px] text-ink backdrop-blur">
          <strong className="font-medium">Preview mode</strong> — Supabase isn’t connected yet, so everything you enter is saved only in this browser, not in the cloud.
        </div>
      )}
      <aside className={cx('print:hidden fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-beige/60 bg-cream/70 backdrop-blur lg:block', isPreview && 'top-8')}>
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className={cx('print:hidden sticky z-30 flex items-center justify-between border-b border-beige/60 bg-ivory/85 px-4 py-3 backdrop-blur lg:hidden', isPreview ? 'top-8' : 'top-0')}>
        <NavLink to="/"><Wordmark /></NavLink>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="flex size-10 items-center justify-center rounded-full hover:bg-linen cursor-pointer"><Menu className="size-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] animate-fade" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] overflow-y-auto bg-cream shadow-lift animate-rise">
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-6 flex size-9 items-center justify-center rounded-full hover:bg-linen cursor-pointer"><X className="size-4" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="lg:pl-[272px] print:pl-0">
        <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-28 sm:px-8 lg:px-12 lg:pt-12 lg:pb-16">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-beige/70 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {[NAV[0], NAV[1], NAV[2], NAV[3], { to: '/becoming', label: 'Becoming', icon: Compass, end: false }].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[10.5px]', isActive ? 'text-ink' : 'text-taupe-deep')}>
              <Icon className="size-5" strokeWidth={1.5} />
              <span className="truncate">{label === 'Manifestation Coach' ? 'Coach' : label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
