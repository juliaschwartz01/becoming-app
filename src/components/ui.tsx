import {
  createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { NavLink } from 'react-router-dom'
import { AlertCircle, Check, Loader2, RotateCcw, X } from 'lucide-react'
import { cx } from '../lib/utils'
import { isPreview } from '../lib/config'

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-ivory hover:bg-[#2c2723] shadow-soft',
  secondary: 'bg-white/70 text-ink border border-beige hover:border-sand hover:bg-white',
  ghost: 'text-ink-soft hover:text-ink hover:bg-linen/70',
  quiet: 'bg-linen/70 text-ink hover:bg-linen',
  danger: 'bg-white text-[#9a4a3f] border border-[#e8cfc8] hover:bg-[#fbf1ee]',
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref,
) {
  const sizes = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-[15px] gap-2' }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-medium tracking-[0.01em] transition-all duration-200 select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer',
        sizes[size], variants[variant], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('inline-flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-linen hover:text-ink cursor-pointer disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Surfaces & typography
// ---------------------------------------------------------------------------
export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: any; [k: string]: any }) {
  return (
    <As className={cx('rounded-xl2 border border-beige/70 bg-white/60 shadow-soft backdrop-blur-[2px]', className)} {...rest}>
      {children}
    </As>
  )
}

export function PageHeader({ eyebrow, title, intro, actions, children }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 animate-rise">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-[3.2rem] text-ink">{title}</h1>
          {intro && <p className="mt-3 text-ink-soft max-w-xl">{intro}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-4 flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-[1.6rem] leading-tight">{children}</h2>
      {action}
    </div>
  )
}

export function SubNav({ items }: { items: { to: string; label: string; end?: boolean }[] }) {
  return (
    <nav className="mt-6 -mx-4 overflow-x-auto px-4 scroll-soft">
      <div className="inline-flex gap-1 rounded-full border border-beige/80 bg-white/50 p-1">
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) => cx(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition',
              isActive ? 'bg-ink text-ivory' : 'text-ink-soft hover:text-ink hover:bg-linen/70',
            )}
          >
            {i.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Badge({ children, tone = 'linen', className }: { children: ReactNode; tone?: 'linen' | 'sage' | 'blush' | 'ink'; className?: string }) {
  const tones = { linen: 'bg-linen text-ink-soft', sage: 'bg-sage-100 text-sage-deep', blush: 'bg-blush-50 text-blush-deep', ink: 'bg-ink text-ivory' }
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide', tones[tone], className)}>{children}</span>
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1 text-[13px] transition cursor-pointer',
        active ? 'border-ink bg-ink text-ivory' : 'border-beige bg-white/60 text-ink-soft hover:border-sand hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------
const fieldBase = 'w-full rounded-xl border border-beige bg-white/80 px-3.5 text-[15px] text-ink placeholder:text-taupe transition focus:border-sage focus:bg-white focus:outline-none focus:ring-4 focus:ring-sage-100'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, 'h-11', className)} {...rest} />
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(fieldBase, 'py-3 leading-relaxed', className)} {...rest} />
})
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(fieldBase, 'h-11 appearance-none pr-8 bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2385766a%27 stroke-width=%272%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-no-repeat bg-[right_0.9rem_center]', className)} {...rest}>{children}</select>
}
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-taupe-deep">{hint}</span>}
    </label>
  )
}

export function TagInput({ value, onChange, placeholder = 'Add a tag and press Enter', suggestions }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [text, setText] = useState('')
  const add = (t: string) => {
    const tag = t.trim().replace(/^#/, '').toLowerCase()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setText('')
  }
  const remaining = (suggestions ?? []).filter((s) => !value.includes(s)).slice(0, 8)
  return (
    <div>
      <div className={cx(fieldBase, 'flex min-h-11 flex-wrap items-center gap-1.5 py-1.5')}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-linen px-2.5 py-0.5 text-[13px]">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-taupe-deep hover:text-ink cursor-pointer"><X className="size-3" /></button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 bg-transparent py-1 outline-none placeholder:text-taupe"
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text) }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => text && add(text)}
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => <button type="button" key={s} onClick={() => add(s)} className="rounded-full border border-dashed border-sand px-2.5 py-0.5 text-xs text-ink-soft hover:border-taupe cursor-pointer">+ {s}</button>)}
        </div>
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-[15px]">{label}</span>
        {description && <span className="block text-[13px] text-ink-soft">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition cursor-pointer', checked ? 'bg-sage-deep' : 'bg-sand')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  )
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-taupe', className)} />
}
export function Loading({ label = 'Gathering your things…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 justify-center text-ink-soft animate-fade">
      <Spinner /> <span className="font-display text-lg italic">{label}</span>
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl2 border border-[#ead2cb] bg-[#fbf3f0] p-5 text-[14px] text-[#7d4339] sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={onRetry}>Try again</Button>}
    </div>
  )
}
export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-sand/80 bg-white/30 px-6 py-14 text-center animate-fade">
      {icon && <div className="mb-4 text-taupe">{icon}</div>}
      <p className="font-display text-2xl">{title}</p>
      {body && <p className="mt-2 max-w-md text-[14px] text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
export function SaveStatus({ state, error }: { state: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; error?: string | null }) {
  const map = {
    idle: '', pending: 'Unsaved changes…', saving: 'Saving…', saved: isPreview ? 'Saved in this browser (preview)' : 'Saved to your cloud', error: error ? `Not saved — ${error}` : 'Not saved',
  }
  if (state === 'idle') return null
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs', state === 'error' ? 'text-[#9a4a3f]' : 'text-taupe-deep')} aria-live="polite">
      {state === 'saving' && <Loader2 className="size-3 animate-spin" />}
      {state === 'saved' && <Check className="size-3" />}
      {map[state]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select')?.focus(), 30)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[3px] animate-fade" onClick={onClose} />
      <div ref={ref} className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-ivory shadow-lift animate-rise sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-beige/70 px-6 py-4">
          <h2 className="text-2xl">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="overflow-y-auto px-6 py-5 scroll-soft">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-beige/70 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toasts & confirmation
// ---------------------------------------------------------------------------
interface Toast { id: number; message: string; tone: 'ok' | 'error' | 'info' }
interface FeedbackApi {
  toast(message: string, tone?: Toast['tone']): void
  confirm(opts: { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean }): Promise<boolean>
}
const FeedbackCtx = createContext<FeedbackApi | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<null | { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean; resolve: (v: boolean) => void }>(null)
  const toast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6500 : 3200)
  }, [])
  const confirm = useCallback<FeedbackApi['confirm']>((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), [])
  const close = (v: boolean) => { dialog?.resolve(v); setDialog(null) }

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-sm shadow-lift animate-rise', t.tone === 'error' ? 'bg-[#7d4339] text-white' : 'bg-ink text-ivory')}>
            {t.tone === 'ok' && <Check className="size-4" />}
            {t.tone === 'error' && <AlertCircle className="size-4" />}
            {t.message}
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        footer={<>
          <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button variant={dialog?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{dialog?.confirmLabel ?? 'Confirm'}</Button>
        </>}
      >
        <div className="text-[15px] text-ink-soft">{dialog?.body}</div>
      </Modal>
    </FeedbackCtx.Provider>
  )
}
export function useFeedback() {
  const v = useContext(FeedbackCtx)
  if (!v) throw new Error('useFeedback outside provider')
  return v
}

/** Wrap an async action with a toast on success and a clear error on failure. */
export function useAction() {
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true)
    try {
      const r = await fn()
      if (success) toast(success)
      return r
    } catch (e) {
      toast((e as Error).message || 'Something went wrong', 'error')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [toast])
  return { run, busy }
}
