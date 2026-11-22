import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { isArtifact } from './lib/config'
import { AuthProvider, useAuth } from './lib/auth'
import { ProfileProvider, useProfile } from './lib/profile'
import { ErrorState, FeedbackProvider, Loading, PageHeader, SubNav } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'

const Rituals = lazy(() => import('./pages/Rituals'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Envision = lazy(() => import('./pages/envision/Envision'))
const BoardEditor = lazy(() => import('./pages/envision/BoardEditor'))
const Journal = lazy(() => import('./pages/inner/Journal'))
const JournalEntryPage = lazy(() => import('./pages/inner/JournalEntry'))
const Confidante = lazy(() => import('./pages/inner/Confidante'))
const Mood = lazy(() => import('./pages/inner/Mood'))
const Reflections = lazy(() => import('./pages/inner/Reflections'))
const CoachChat = lazy(() => import('./pages/coach/CoachChat'))
const Methods = lazy(() => import('./pages/coach/Methods'))
const MethodPractice = lazy(() => import('./pages/coach/MethodPractice'))
const Goals = lazy(() => import('./pages/coach/Goals'))
const GoalDetail = lazy(() => import('./pages/coach/GoalDetail'))
const Beliefs = lazy(() => import('./pages/coach/Beliefs'))
const Library = lazy(() => import('./pages/library/Library'))
const ResourcePage = lazy(() => import('./pages/library/Resource'))
const AskLibrary = lazy(() => import('./pages/library/AskLibrary'))
const Chapters = lazy(() => import('./pages/becoming/Chapters'))
const ChapterPage = lazy(() => import('./pages/becoming/Chapter'))
const Evidence = lazy(() => import('./pages/becoming/Evidence'))
const FutureMe = lazy(() => import('./pages/becoming/FutureMe'))
const Timeline = lazy(() => import('./pages/becoming/Timeline'))
const Report = lazy(() => import('./pages/becoming/Report'))
const Memory = lazy(() => import('./pages/Memory'))
const Settings = lazy(() => import('./pages/Settings'))

function Section({ eyebrow, title, intro, tabs }: { eyebrow: string; title: ReactNode; intro: ReactNode; tabs: { to: string; label: string; end?: boolean }[] }) {
  return (
    <>
      <div className="print:hidden"><PageHeader eyebrow={eyebrow} title={title} intro={intro}><SubNav items={tabs} /></PageHeader></div>
      <Suspense fallback={<Loading />}><Outlet /></Suspense>
    </>
  )
}

function Protected() {
  const auth = useAuth()
  if (auth.loading) return <div className="paper min-h-dvh"><Loading label="Opening your sanctuary…" /></div>
  if (isArtifact && !auth.userId) return <ArtifactSignedOut />
  if (!auth.userId || auth.recovering) return <Login />
  return <ProfileProvider><Shell /></ProfileProvider>
}

function ArtifactSignedOut() {
  return (
    <div className="paper flex min-h-dvh items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl">Becoming</h1>
        <p className="mt-4 text-ink-soft">Your sanctuary opens only for you. Open this page on claude.ai while signed in to your Claude account to see your journal, boards and everything you’ve saved.</p>
      </div>
    </div>
  )
}

function Shell() {
  const { loading, error, reload, profile } = useProfile()
  if (loading && !profile) return <div className="paper min-h-dvh"><Loading label="Opening your sanctuary…" /></div>
  if (error && !profile) return <div className="paper min-h-dvh p-8"><ErrorState message={error} onRetry={reload} /></div>
  return <Layout />
}

// claude.ai only passes plain #names between the page and its address, so the artifact keeps routes in memory.
const Router = isArtifact ? MemoryRouter : HashRouter

const lazyPage = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <FeedbackProvider>
          <Routes>
            <Route element={<Protected />}>
              <Route index element={<Home />} />
              <Route path="rituals" element={lazyPage(<Rituals />)} />
              <Route path="reminders" element={lazyPage(<Reminders />)} />
              <Route path="envision" element={lazyPage(<Envision />)} />
              <Route path="envision/board/:id" element={lazyPage(<BoardEditor />)} />

              <Route path="inner-world" element={<Section eyebrow="Inner World" title="Journal & confidante" intro="A private place to write, feel, and understand yourself a little better each day." tabs={[
                { to: '/inner-world/journal', label: 'Journal' }, { to: '/inner-world/confidante', label: 'AI confidante' },
                { to: '/inner-world/mood', label: 'Mood' }, { to: '/inner-world/reflections', label: 'Self-discoveries' }]} />}>
                <Route index element={<Navigate to="journal" replace />} />
                <Route path="journal" element={<Journal />} />
                <Route path="confidante" element={<Confidante />} />
                <Route path="mood" element={<Mood />} />
                <Route path="reflections" element={<Reflections />} />
              </Route>
              <Route path="inner-world/journal/:id" element={lazyPage(<JournalEntryPage />)} />

              <Route path="coach" element={<Section eyebrow="Manifestation Coach" title="Your manifestation practice" intro="Goals, plans and practices — connected to your journal, your library and the life you’re building." tabs={[
                { to: '/coach/chat', label: 'Coach' }, { to: '/coach/methods', label: 'Practices' },
                { to: '/coach/goals', label: 'Goals & plans' }, { to: '/coach/beliefs', label: 'Limiting beliefs' }]} />}>
                <Route index element={<Navigate to="chat" replace />} />
                <Route path="chat" element={<CoachChat />} />
                <Route path="methods" element={<Methods />} />
                <Route path="goals" element={<Goals />} />
                <Route path="beliefs" element={<Beliefs />} />
              </Route>
              <Route path="coach/methods/:key" element={lazyPage(<MethodPractice />)} />
              <Route path="coach/goals/:id" element={lazyPage(<GoalDetail />)} />

              <Route path="library" element={lazyPage(<Library />)} />
              <Route path="library/ask" element={lazyPage(<AskLibrary />)} />
              <Route path="library/:id" element={lazyPage(<ResourcePage />)} />

              <Route path="becoming" element={<Section eyebrow="Becoming" title="My personal evolution" intro="The chapters, evidence and moments that show who you are becoming." tabs={[
                { to: '/becoming/chapters', label: 'Life chapters' }, { to: '/becoming/evidence', label: 'Evidence wall' },
                { to: '/becoming/future', label: 'Future me' }, { to: '/becoming/timeline', label: 'Timeline' }, { to: '/becoming/report', label: 'Monthly report' }]} />}>
                <Route index element={<Navigate to="chapters" replace />} />
                <Route path="chapters" element={<Chapters />} />
                <Route path="evidence" element={<Evidence />} />
                <Route path="future" element={<FutureMe />} />
                <Route path="timeline" element={<Timeline />} />
                <Route path="report" element={<Report />} />
              </Route>
              <Route path="becoming/chapters/:id" element={lazyPage(<ChapterPage />)} />

              <Route path="memory" element={lazyPage(<Memory />)} />
              <Route path="settings" element={lazyPage(<Settings />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </FeedbackProvider>
      </AuthProvider>
    </Router>
  )
}
