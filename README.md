# Becoming

A private personal sanctuary for journaling, manifestation, vision boards, personal growth and reflection.

- **Website:** a static React app hosted free on **GitHub Pages**
- **Data, login and files:** your own free **Supabase** project (database, authentication, private storage)
- **No other services.** No Vercel, Netlify, Firebase, AWS, or paid APIs.
- **AI:** the full interface and memory/knowledge retrieval are built, but **no AI model is connected**. Nothing is simulated. See “AI features” below.

Your journal, photos, conversations and memories live only in Supabase, protected by Row Level Security. The GitHub repository contains only code — never personal data or secrets.

---

## Running it on your Mac

You need Node.js (installed in `~/.local/node` during setup). In a terminal, from this folder:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. Without Supabase settings the app runs in **preview mode**: a pink banner says so, and anything you type is stored only in that browser.

Other commands: `npm test` (automated tests), `npm run build` (production build into `dist/`).

---

## Step 1 — Create your Supabase project (about 10 minutes)

1. Go to **https://supabase.com** → **Start your project** → sign in (GitHub sign-in is easiest).
2. Click **New project**. Choose any name (e.g. `becoming`), create a strong **database password** and save it in your password manager, pick the region closest to you, keep the **Free** plan. Click **Create new project** and wait ~2 minutes.

### Create the tables and security rules
3. In the left sidebar open **SQL Editor** → **New query**.
4. Open `supabase/migrations/20261121000001_initial_schema.sql` from this project, copy everything, paste it into the editor, click **Run**. You should see “Success. No rows returned”.
5. **New query** again. Paste `supabase/migrations/20261121000002_private_storage.sql`, click **Run**.
6. (Optional check) **New query**, paste `supabase/tests/verify_security.sql`, **Run**. Every table should say `ok` with 4 policies, and the three buckets should say `ok (private)`.

### Create your one account, then close sign-ups
7. Left sidebar → **Authentication** → **Sign In / Providers** (may be called **Providers**). Under **Email**, make sure Email is enabled. Turn **off** “Allow new users to sign up”. Save.
   *Why:* this stops anyone else from creating an account on your site.
8. **Authentication** → **Users** → **Add user** → **Create new user**. Enter your email and a strong password, tick **Auto Confirm User**, click **Create user**.

### Copy the two connection values
9. Click the **Connect** button at the top of the project (or **Project Settings** → **API Keys** / **Data API**). Copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **Publishable key** — starts with `sb_publishable_…` (older projects call it the **anon public** key)

   These two values are designed to be public. **Never copy the `service_role` / secret key anywhere** — the app does not need it.

10. In this project folder, make a copy of `.env.example` named `.env.local` and paste the two values in. (`.env.local` is ignored by Git, so it never reaches GitHub.) Or simply paste them to Claude and it will do it.
11. Restart `npm run dev`. The pink preview banner disappears and you’ll see the real sign-in screen.

## Step 2 — Put it online with GitHub Pages

1. Create a free account at **https://github.com** if you don’t have one.
2. Create a new repository named **`becoming-app`**. On GitHub Free, Pages requires the repository to be **Public**. That’s fine: the repository contains only code. Your content lives in Supabase behind your login.
3. Push this project to it (Claude can do this for you once GitHub access is set up).
4. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. **Settings → Secrets and variables → Actions → Variables tab → New repository variable**, add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
6. Go to **Actions** → “Deploy to GitHub Pages” → **Run workflow** (it also runs on every push). When it finishes, your site is at `https://<your-username>.github.io/becoming-app/`.

### Tell Supabase about your website address
7. Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `https://<your-username>.github.io/becoming-app/`
   - **Redirect URLs:** add `https://<your-username>.github.io/becoming-app/**` and `http://localhost:5173/**`

   *Why:* password-reset emails may only send you back to addresses on this list.

### Check it
- Sign in on the live site, write a journal entry, then open the site on your phone and confirm it’s there.
- Open the site in a private window without signing in: you should only ever see the sign-in screen.
- Password reset: “Forgot password?” → open the email link **in the same browser** → choose a new password.

---

## What works today vs. what needs an AI model

| Fully working now (GitHub + Supabase only) | Needs an AI model you approve later |
|---|---|
| Login, password reset, change password, sign out | AI confidante replies |
| Journal (autosave, tags, favorites, calendar, search, attachments, daily/weekly/monthly views) | Manifestation Coach replies & AI-generated plans |
| Mood check-ins, history, trends, themes | Future Me conversations |
| Self-discoveries, limiting beliefs with reflections over time | “Ask my library” written answers |
| Goals, manifestation plans, 10 interactive practices with notes & history | AI memory suggestions |
| Morning/evening rituals with history; in-app reminders & calendar | Image generation for vision boards |
| Vision board editor (upload, drag, resize, rotate, text, affirmations, backgrounds, layouts, PNG export), image collection | Automatic transcription |
| Knowledge Library: PDF/EPUB/DOCX/TXT text extraction with page numbers, links, quotes, notes, video/screenshot storage, full-text search | |
| Memory retrieval + library retrieval with citations (“What the AI would see”) | |
| Life chapters, milestones, Evidence Wall, timeline, Monthly Report (print/PDF) | |
| “What my AI knows about me”, export everything, delete everything | |

Conversations still save your messages; they simply show “No reply — an AI model isn’t connected”. Nothing pretends to be AI.

Email or push notifications aren’t offered — they would need an extra service.

## Privacy notes
- Every personal table uses Row Level Security: the database only returns rows that belong to the signed-in user.
- Files live in three **private** buckets (`knowledge`, `vision-images`, `attachments`) and are opened through short-lived signed links.
- Temporary reference photos for future image generation are kept only in the browser tab’s memory and are never uploaded or stored.
- Document text extraction runs in your browser.
- Exports are downloaded to your device — keep them out of this project folder.

## Project structure
```
src/
  ai/             AI integration layer (retrieval works; model calls switched off)
  components/     Layout, shared UI, chat panel, rituals
  data/content.ts Practices, prompts, categories (no personal data)
  lib/            Supabase/preview data layer, auth, autosave, extraction, report, board export
  pages/          Home, Envision, Inner World, Coach, Library, Becoming, Memory, Settings
supabase/
  migrations/     SQL to run in the Supabase SQL Editor
  functions/      Edge Functions for future AI (ai-chat, ai-image, ai-transcribe) — not deployed
  tests/          Read-only security check
.github/workflows/deploy.yml   Builds and publishes to GitHub Pages
```
