# CLAUDE.md — Becoming

Guidance for Claude Code when maintaining this project. The owner is a non-technical beginner: explain manual steps plainly (which site, where to click, what to copy, why), never ask for secrets in chat beyond the public Supabase URL/publishable key, and make reasonable decisions without unnecessary questions.

## Two ways Becoming runs (decided 2026-11-22)
1. **claude.ai artifact — the main version.** the owner's private artifact titled "Becoming" (find its link with the Artifact tool's list action; kept out of this public repo). Data in the artifact's private per-user db subtree (`data/users/<id>/tables/<table>/…`) and asset store; AI through the `sample` capability on the owner's own Claude account (no API key, no extra cost — the owner explicitly chose this over paid APIs). Build with `npm run build:artifact` → `dist-artifact/` (page.html + files.json), then publish `dist-artifact/page.html` with the Artifact tool to that artifact, passing every entry of `files.json` as `files` (the `.mjs` worker needs `contentType: text/javascript`) and capabilities `{db:{}, user:{}, assets:{}, sample:{}, downloads:true}`. Hashed asset names change on rebuild: pass `null` for files that disappeared.
2. **GitHub Pages website + Supabase** — still deployed (https://juliaschwartz01.github.io/becoming-app/), AI off there. Kept as an alternative; the owner may retire it later.
The artifact cannot reach Supabase (claude.ai blocks outside network requests), so the two versions don't share data. Settings → Import moves a .json export from the website into the artifact.

## Hard rules
- Services: **claude.ai artifact (main), GitHub (code + Pages), Supabase (website data)**. No Vercel/Netlify/Firebase/AWS/other DBs. **No paid API or AI provider** — the owner declined extra costs (Claude API and OpenAI API were both explained and declined on 2026-11-22).
- **Never commit** personal data, exports, photos, `.env*` files, or any secret. The repo is public (GitHub Free + Pages).
- **Never fake AI.** If a model isn’t configured, show the setup-required state. No simulated replies, no fake success toasts.
- Original reference photos of the owner must **never** be uploaded to Storage, saved in the DB, added to the library or committed. Only finished images the owner explicitly chooses to “Keep” go to the private `vision-images` bucket.
- AI credentials only as **Supabase Edge Function secrets**, never in frontend code or GitHub.
- Preserve production data. Never delete/overwrite production data or run destructive SQL without explaining and getting approval. New schema changes go in a **new** migration file; never edit an applied one.
- Use they/them for the owner unless they state otherwise.

## Stack
React 19 + TypeScript + Vite 8 + Tailwind CSS 4 (custom components, no shadcn), `HashRouter` (GitHub Pages compatible), Vite `base: './'` (works under any repo name), Supabase JS v2 with PKCE auth, pdf.js / mammoth / JSZip for in-browser text extraction, Vitest.

Node lives at `~/.local/node/bin` and GitHub CLI at `~/.local/gh/bin` (not on PATH by default): prefix commands with `export PATH="$HOME/.local/node/bin:$HOME/.local/gh/bin:$PATH"`.
Commits in this public repo must use the owner's GitHub *noreply* email (set in the repo's local git config), never a personal address.
Deploys: the `test` job always runs; `build`/`deploy` only run once the `VITE_SUPABASE_URL` repository variable exists.

Commands: `npm run dev` · `npm test` · `npm run build` · `npx tsc -b`.

## Architecture
- `src/lib/config.ts` — env config. No Supabase env → **preview mode** (LocalBackend, browser-only, clearly bannered). Live site always has Supabase (deploy workflow fails without it).
- `src/lib/db.ts` — picks the backend: `ArtifactBackend` (claude.ai), `SupabaseBackend` (website; paginates past 1000 rows, strips generated `search` columns) or `LocalBackend` (preview). All pages use `db`, never `supabase.from` directly. `db.upload()` returns the stored path/id to keep.
- `src/lib/store-core.ts` — shared types, `MemoryBackend` (in-memory tables with a pluggable `RowStore`; mirrors SQL defaults, unique keys, ON DELETE CASCADE, simple keyword search) and `LocalBackend`.
- `src/lib/artifact.ts` — claude.ai runtime: per-user db row store (knowledge passages grouped 40 per document; 256 KiB/doc, 25k docs per artifact), asset store files (types the store can't hold are kept as base64 text, ≤14 MB; native types ≤20 MB), downloads, `getSample()`.
- In the artifact build: `MemoryRouter` (claude.ai only passes plain #names), no login screen (identity = Claude account), downloads via the `downloads` capability, no print, and `scripts/artifact-page.mjs` escapes raw control characters claude.ai rejects.
- `src/lib/auth.tsx` — sign-in, reset (`?recovery=1` + PKCE code), `requireUserId()` (storage paths must start with the user id).
- `src/lib/profile.tsx` — profile + preferences context (dashboard widgets, rituals, affirmations, memory-suggestion toggle).
- `src/lib/hooks.ts` — `useData` (loading/error/retry), `useAutosave` (debounced, flushes on unmount), signed URL cache.
- `src/ai/prompts.ts` — the instructions for each conversation kind.
- `src/ai/index.ts` — `sendChat` (claude.ai: `sample` with streaming; website: Edge Function, off), `askClaudeJSON` (vision ideas, plan drafts), `suggestMemories` (only when the owner's toggle is on; suggestions stay pending until approved), `buildContext()` (real retrieval: relevant verified memories via `search_memories`, active goals, evidence when asking for encouragement, library passages via `search_passages`, last 12 messages; knowledge and personal memory kept separate), `sendChat/generateImages/transcribe` call Edge Functions only when the matching `VITE_*_ENABLED` flag is true.
- `src/components/ChatPanel.tsx` — shared chat UI for confidante, coach, future_self, library. Saves user messages; shows “What the AI would see”.
- `supabase/functions/ai-chat` — persona/system prompts, citation mapping, `callModel()` stub. Returns 503 `not_configured` until a provider is approved. `ai-image`, `ai-transcribe` are stubs with privacy rules.
- Storage buckets (private): `knowledge`, `vision-images`, `attachments`; path `<uid>/...` enforced by storage policies.

## Database (supabase/migrations)
`001_initial_schema.sql`: profiles, user_preferences, life_chapters, goals, manifestation_plans, milestones, journal_entries, mood_entries, reflections, limiting_beliefs, practices, method_notes, ritual_completions, reminders, memories (origin user|ai_inferred, status verified|pending|rejected), conversations, messages, vision_boards, vision_images, vision_board_elements, visions, knowledge_resources, knowledge_passages, achievements, monthly_reviews. Every table: `user_id default auth.uid()`, RLS forced, 4 owner policies, `updated_at` trigger, revoke from `anon`. Full-text `search` tsvector columns + GIN on journal, memories, resources, passages. RPCs `search_passages`, `search_memories` (security invoker).
`002_private_storage.sql`: buckets + owner-folder storage policies.
Keep `src/lib/types.ts` and `LocalBackend` defaults in sync with any schema change.

## Connecting a paid AI provider to the website (only with approval — currently declined)
1. Owner chooses a provider; explain cost, privacy and retention first.
2. Install Supabase CLI, `supabase login`, `supabase link --project-ref <ref>`.
3. `supabase secrets set AI_PROVIDER=<name> AI_API_KEY=<key>` (owner types the key in their own terminal).
4. Implement `callModel()` in `supabase/functions/ai-chat/index.ts`; optionally populate `suggested_memories` (only lasting, explicitly shared facts — never temporary feelings).
5. `supabase functions deploy ai-chat`.
6. GitHub → Settings → Secrets and variables → Actions → Variables: `VITE_AI_ENABLED=true`. Re-run deploy.
Image generation / transcription follow the same pattern with `ai-image` / `ai-transcribe` and `VITE_IMAGE_GENERATION_ENABLED` / `VITE_TRANSCRIPTION_ENABLED`. Optional pgvector embeddings could improve retrieval later (needs an embedding model → approval).

## Feature checklist
Stage 1 — Foundation
- [x] React/Vite/TS project, Tailwind design system (ivory/cream/sage/beige/taupe/blush, Cormorant Garamond + DM Sans, self-hosted fonts)
- [x] Six sections + Memory + Settings, HashRouter, responsive sidebar / mobile bottom nav
- [x] Login screen (+ preview entry when Supabase not configured)

Stage 2 — Supabase
- [x] SQL migrations, RLS on every table, private storage buckets, security check script
- [x] Supabase project `itncungddtelykrhouvv` created; migrations 001 + 002 applied (25 tables RLS-protected, 100 policies, 3 private buckets); owner account created; sign-ups disabled (verified: signup_disabled)
- [x] `.env.local` connected (gitignored). Verified as anonymous: tables 401, RPC denied, storage list empty
- [x] Owner signed in on the live site successfully (2026-11-22)

Stage 3 — Functional (all persist via `db`)
- [x] Journal (autosave, prompts, tags, favorites, calendar, search, attachments, D/W/M views, mood links)
- [x] Mood tracking (check-ins, energy, themes, context, journal link, trend chart, counts)
- [x] Goals + manifestation plans (actions, affirmations, visualization, prompts, gratitude, weekly reflection)
- [x] 10 practices with research vs tradition, step-by-step, notes, completion history
- [x] Limiting beliefs with reflections timeline
- [x] Rituals (configurable, history, consistency grid), reminders (repeat rules, calendar, Home widget)
- [x] Knowledge Library (uploads ≤50 MB, PDF/EPUB/DOCX/TXT/MD/HTML extraction with pages, scanned-PDF detection, links/TikTok with manual transcript, quotes, notes, search, passages)
- [x] Vision boards (multi-board, drag/resize/rotate/layer, text & affirmations, backgrounds, layouts, autosave, PNG export) + image collection (categories, move, download, delete)
- [x] Memory page (profile, verified memories, pending AI suggestions separated, toggle, export)
- [x] Life chapters, milestones, Evidence Wall, Timeline, Monthly Report (deterministic, saved, print/PDF)
- [x] Settings: account, change password, rituals, affirmations, connection status, export JSON/ZIP, delete all data

Stage 4b — claude.ai artifact (2026-11-22)
- [x] ArtifactBackend (private per-user storage + assets), Claude via `sample` in confidante/coach/Future Me/Ask my library, "Ask Claude for ideas" on vision boards, "Suggest a plan" on goals, memory suggestions, import from website export
- [x] Published privately as the claude.ai artifact "Becoming"
- [ ] Owner opens it, allows Claude, and tests saving + a conversation (not yet verified — the session's browser isn't signed in to claude.ai)

Stage 4 — AI-ready
- [x] Confidante (6 modes), Coach (goal focus, starters), Future Me (year/chapter/goal/areas), Ask my library — setup-required states, saved threads
- [x] Shared memory + knowledge retrieval with citations (works now, previewable)
- [x] Edge Function stubs for chat / image / transcription; temporary reference-photo handling
- [ ] Connect a real provider (needs owner approval)

Stage 5 — Deployment
- [x] GitHub Actions workflow (tests → build → Pages), `.gitignore` for secrets/exports
- [x] Create `becoming-app` repo (github.com/juliaschwartz01/becoming-app, public), push, enable Pages (build type: workflow). First run: tests passed, build/deploy skipped pending variables.
- [x] Repo variables set; site live at https://juliaschwartz01.github.io/becoming-app/
- [ ] Supabase Auth Site URL + redirect URLs; test live login, cross-device persistence, signed-out access

Stage 6 — Testing
- [x] 15 unit tests (utils, reminders, report, layout, retrieval helpers, preview backend)
- [x] Every route loads without console errors in preview; journal autosave, board editing/PNG export, library note + retrieval, chat setup state tested in browser
- [ ] End-to-end checks against the real Supabase project and live site

## Known limitations / ideas
- PKCE password reset must be completed in the same browser that requested it.
- Board export draws images via signed URLs (CORS-enabled by Supabase).
- Image-only PDFs aren’t OCR’d (would need an extra service); users add text manually.
- Storage free plan: 1 GB total, 50 MB per file.
