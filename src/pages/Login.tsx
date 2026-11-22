import { useState, type FormEvent } from 'react'
import { ArrowRight, Lock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button, Field, Input } from '../components/ui'
import { isPreview } from '../lib/config'

type Mode = 'signin' | 'forgot' | 'recover'

export default function Login() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>(auth.recovering && auth.userId ? 'recover' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setNotice(null); setBusy(true)
    try {
      if (mode === 'signin') await auth.signIn(email, password)
      if (mode === 'forgot') {
        await auth.sendPasswordReset(email)
        setNotice('If that email belongs to your account, a reset link is on its way. Open it in this same browser.')
      }
      if (mode === 'recover') {
        if (password.length < 10) throw new Error('Please use at least 10 characters.')
        if (password !== password2) throw new Error('The two passwords don’t match.')
        await auth.updatePassword(password)
        auth.finishRecovery()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="paper grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Editorial side */}
      <div className="relative hidden overflow-hidden bg-linen lg:block grain">
        <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_20%_10%,rgba(214,177,166,0.45),transparent_60%),radial-gradient(700px_600px_at_90%_90%,rgba(141,156,126,0.40),transparent_60%)]" />
        <div className="absolute left-[12%] top-[16%] h-[42%] w-[38%] rounded-[40%_40%_6px_6px] bg-[linear-gradient(160deg,#efe2d6,#d9c3b5)] shadow-lift" />
        <div className="absolute right-[14%] top-[26%] h-[30%] w-[26%] rotate-3 rounded-md bg-[linear-gradient(200deg,#e1e7d9,#b9c6ab)] shadow-lift" />
        <div className="absolute bottom-[14%] left-[26%] h-[22%] w-[30%] -rotate-2 rounded-md bg-[linear-gradient(120deg,#f5eee4,#e6dac8)] shadow-lift" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <p className="eyebrow">A private sanctuary</p>
          <div>
            <h1 className="font-display text-[5.5rem] leading-[0.9] text-ink">Becoming</h1>
            <p className="mt-5 max-w-sm font-display text-2xl italic text-ink-soft">A quiet place to imagine, reflect, and grow into the life you’re choosing.</p>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 lg:hidden">
            <h1 className="font-display text-6xl leading-none">Becoming</h1>
            <p className="mt-3 font-display text-xl italic text-ink-soft">Your private sanctuary.</p>
          </div>

          {isPreview ? (
            <div>
              <p className="eyebrow mb-3">Preview</p>
              <h2 className="text-4xl">Welcome in</h2>
              <p className="mt-3 text-[14.5px] text-ink-soft">
                Supabase isn’t connected yet. You can explore Becoming in preview mode: anything you enter is kept only in this browser on this computer.
                Once Supabase is set up, this screen becomes your private email-and-password sign-in.
              </p>
              <Button variant="primary" size="lg" className="mt-8 w-full" icon={<ArrowRight className="size-4" />} onClick={auth.enterPreview}>Enter preview</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <p className="eyebrow mb-3">{mode === 'signin' ? 'Welcome back' : mode === 'forgot' ? 'Reset password' : 'Choose a new password'}</p>
                <h2 className="text-4xl">{mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Forgot your password?' : 'New password'}</h2>
              </div>
              {mode !== 'recover' && (
                <Field label="Email">
                  <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'recover' ? 'New password' : 'Password'} hint={mode === 'recover' ? 'At least 10 characters.' : undefined}>
                  <Input type="password" autoComplete={mode === 'recover' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}
              {mode === 'recover' && (
                <Field label="Repeat new password">
                  <Input type="password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </Field>
              )}
              {error && <p role="alert" className="rounded-xl bg-[#fbf1ee] px-3 py-2 text-[13.5px] text-[#8a4337]">{error}</p>}
              {notice && <p className="rounded-xl bg-sage-50 px-3 py-2 text-[13.5px] text-sage-deep">{notice}</p>}
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} icon={<Lock className="size-4" />}>
                {mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}
              </Button>
              <div className="text-center text-[13.5px]">
                {mode === 'signin' && <button type="button" className="text-ink-soft underline decoration-sand underline-offset-4 hover:text-ink cursor-pointer" onClick={() => { setMode('forgot'); setError(null) }}>Forgot password?</button>}
                {mode === 'forgot' && <button type="button" className="text-ink-soft underline decoration-sand underline-offset-4 hover:text-ink cursor-pointer" onClick={() => { setMode('signin'); setNotice(null); setError(null) }}>Back to sign in</button>}
              </div>
              <p className="pt-6 text-center text-xs text-taupe-deep">This is a private, single-person space. New sign-ups are disabled.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
