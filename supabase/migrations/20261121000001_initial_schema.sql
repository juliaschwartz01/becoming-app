-- =====================================================================
-- Becoming — initial database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run on an empty project. It never deletes existing data.
--
-- Security model:
--   * Every personal table has a user_id column that defaults to the signed-in user.
--   * Row Level Security (RLS) is enabled on every table, so the database itself
--     refuses to show or change rows that do not belong to the signed-in user.
--   * Anonymous (signed-out) visitors get no access to any table.
-- =====================================================================

create extension if not exists pgcrypto;

-- Joins a tag list into plain text for full-text search. Marked IMMUTABLE so it can be
-- used in generated "search" columns (the built-in array_to_string is not).
create or replace function public.tags_to_text(tags text[])
returns text language sql immutable parallel safe as $$
  select coalesce(array_to_string(tags, ' '), '')
$$;

-- Keeps updated_at current on every update
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profile & preferences (one row per user)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  preferred_name text,
  about text,
  personal_values text[] not null default '{}',
  priorities text[] not null default '{}',
  communication_style text,
  daily_intention text,
  intention_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dashboard_widgets jsonb not null default '[]'::jsonb,
  morning_practices text[] not null default '{gratitude,affirmation,visualization,intention,action}',
  evening_practices text[] not null default '{reflect,mood,wins,gratitude,release}',
  affirmations text[] not null default '{}',
  memory_suggestions_enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Life chapters & goals
-- ---------------------------------------------------------------------
create table if not exists public.life_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  affirmations text[] not null default '{}',
  status text not null default 'current' check (status in ('upcoming','current','completed')),
  start_date date,
  end_date date,
  cover_image_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'personal-growth',
  status text not null default 'active' check (status in ('active','completed','archived')),
  target_date date,
  completed_at timestamptz,
  chapter_id uuid references public.life_chapters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manifestation_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  affirmations text[] not null default '{}',
  visualization text,
  journaling_prompts text[] not null default '{}',
  gratitude text,
  weekly_reflection text,
  actions jsonb not null default '[]'::jsonb,   -- [{ "id", "text", "done" }]
  source text not null default 'manual' check (source in ('manual','ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id)
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  chapter_id uuid references public.life_chapters(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Journal, moods, reflections
-- ---------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  body text not null default '',
  prompt text,
  entry_date date not null default current_date,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  chapter_id uuid references public.life_chapters(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb, -- [{ "path", "name", "type", "size" }] in private bucket "attachments"
  search tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || public.tags_to_text(tags))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  label text,
  energy smallint check (energy between 1 and 5),
  context text,
  themes text[] not null default '{}',
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'realization', -- motivation | learning | realization | fear | practice
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.limiting_beliefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  belief text not null,
  origin text,
  alternative text,
  practice_key text,
  status text not null default 'exploring' check (status in ('exploring','softening','released')),
  reflections jsonb not null default '[]'::jsonb, -- [{ "id", "date", "text" }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Practices, rituals, reminders
-- ---------------------------------------------------------------------
create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  method_key text not null,               -- visualization | scripting | affirmations | ...
  content jsonb not null default '{}'::jsonb,
  reflection text,
  goal_id uuid references public.goals(id) on delete set null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.method_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  method_key text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, method_key)
);

create table if not exists public.ritual_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ritual_date date not null default current_date,
  period text not null check (period in ('morning','evening')),
  practice_key text not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ritual_date, period, practice_key)
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz not null,
  repeat text not null default 'none' check (repeat in ('none','daily','weekly','monthly')),
  kind text not null default 'general', -- general | goal | ritual | reflection
  goal_id uuid references public.goals(id) on delete set null,
  done boolean not null default false,
  last_done_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Memory system ("What my AI knows about me")
--   origin = 'user'        → things I wrote myself (always verified)
--   origin = 'ai_inferred' → suggestions an AI made; never used until I approve them
-- ---------------------------------------------------------------------
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'about-me', -- about-me | preference | value | milestone | reflection | relationship | goal
  origin text not null default 'user' check (origin in ('user','ai_inferred')),
  status text not null default 'verified' check (status in ('verified','pending','rejected')),
  importance smallint not null default 2 check (importance between 1 and 3),
  goal_id uuid references public.goals(id) on delete set null,
  source_conversation_id uuid,
  search tsvector generated always as (to_tsvector('english', coalesce(content,'') || ' ' || coalesce(category,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Conversations (confidante, coach, future self, library, vision)
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('confidante','coach','future_self','library','vision')),
  mode text,
  title text not null default 'New conversation',
  context jsonb not null default '{}'::jsonb, -- e.g. { "future_year": 2030, "chapter_id": "...", "areas": [] }
  goal_id uuid references public.goals(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb, -- [{ "resource_id", "passage_id", "page", "title" }]
  memory_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Vision boards
-- ---------------------------------------------------------------------
create table if not exists public.vision_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled board',
  category text not null default 'lifestyle',
  description text,
  background text not null default '#f4ede3',
  width int not null default 1600,
  height int not null default 1000,
  goal_id uuid references public.goals(id) on delete set null,
  chapter_id uuid references public.life_chapters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Saved images (uploads I chose to keep, or finished AI images I chose to keep).
-- Original reference photos of me are NEVER stored here.
create table if not exists public.vision_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null,       -- path inside the private "vision-images" bucket
  title text,
  category text not null default 'lifestyle',
  board_id uuid references public.vision_boards(id) on delete set null,
  source text not null default 'upload' check (source in ('upload','generated')),
  prompt text,
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vision_board_elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id uuid not null references public.vision_boards(id) on delete cascade,
  type text not null check (type in ('image','text','affirmation')),
  x real not null default 0,
  y real not null default 0,
  w real not null default 300,
  h real not null default 300,
  rotation real not null default 0,
  z int not null default 0,
  content text,
  image_id uuid references public.vision_images(id) on delete cascade,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Written descriptions of the life I want ("visions"), linked to boards and goals
create table if not exists public.visions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id uuid references public.vision_boards(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  description text not null,
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Knowledge library (kept separate from personal memories)
-- ---------------------------------------------------------------------
create table if not exists public.knowledge_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  author text,
  type text not null default 'note', -- pdf | book | document | note | quote | tiktok | article | video | transcript | screenshot
  description text,
  category text not null default 'manifestation',
  tags text[] not null default '{}',
  url text,
  storage_path text,            -- path inside the private "knowledge" bucket
  file_name text,
  mime_type text,
  file_size bigint,
  personal_notes text,
  extraction_status text not null default 'none' check (extraction_status in ('none','extracted','manual','unsupported','failed')),
  page_count int,
  favorite boolean not null default false,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(author,'') || ' ' || coalesce(description,'') || ' ' || coalesce(personal_notes,'') || ' ' || public.tags_to_text(tags))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resource_id uuid not null references public.knowledge_resources(id) on delete cascade,
  passage_index int not null,
  page_number int,
  content text not null,
  search tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Evidence wall & monthly reviews
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'achievement', -- achievement | compliment | memory | victory | challenge | courage
  title text not null,
  description text,
  occurred_on date not null default current_date,
  goal_id uuid references public.goals(id) on delete set null,
  chapter_id uuid references public.life_chapters(id) on delete set null,
  image_id uuid references public.vision_images(id) on delete set null,
  is_breakthrough boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,               -- first day of the month
  snapshot jsonb not null default '{}'::jsonb,
  highlights text,
  intention_next text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index if not exists journal_user_date_idx on public.journal_entries (user_id, entry_date desc);
create index if not exists journal_search_idx on public.journal_entries using gin (search);
create index if not exists mood_user_time_idx on public.mood_entries (user_id, recorded_at desc);
create index if not exists memories_user_idx on public.memories (user_id, status);
create index if not exists memories_search_idx on public.memories using gin (search);
create index if not exists goals_user_idx on public.goals (user_id, status);
create index if not exists conversations_user_idx on public.conversations (user_id, kind, updated_at desc);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);
create index if not exists elements_board_idx on public.vision_board_elements (board_id, z);
create index if not exists images_user_idx on public.vision_images (user_id, category);
create index if not exists resources_user_idx on public.knowledge_resources (user_id, created_at desc);
create index if not exists resources_search_idx on public.knowledge_resources using gin (search);
create index if not exists passages_resource_idx on public.knowledge_passages (resource_id, passage_index);
create index if not exists passages_search_idx on public.knowledge_passages using gin (search);
create index if not exists rituals_user_date_idx on public.ritual_completions (user_id, ritual_date desc);
create index if not exists reminders_user_due_idx on public.reminders (user_id, due_at);
create index if not exists practices_user_idx on public.practices (user_id, completed_at desc);
create index if not exists achievements_user_idx on public.achievements (user_id, occurred_on desc);
create index if not exists milestones_user_idx on public.milestones (user_id, chapter_id);

-- ---------------------------------------------------------------------
-- updated_at triggers + Row Level Security on every personal table
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_preferences','life_chapters','goals','manifestation_plans','milestones',
    'journal_entries','mood_entries','reflections','limiting_beliefs','practices','method_notes',
    'ritual_completions','reminders','memories','conversations','messages','vision_boards',
    'vision_images','vision_board_elements','visions','knowledge_resources','knowledge_passages',
    'achievements','monthly_reviews'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "owner_select" on public.%I', t);
    execute format('drop policy if exists "owner_insert" on public.%I', t);
    execute format('drop policy if exists "owner_update" on public.%I', t);
    execute format('drop policy if exists "owner_delete" on public.%I', t);
    execute format('create policy "owner_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Search helpers (run with the caller's permissions, so RLS still applies)
-- ---------------------------------------------------------------------
create or replace function public.search_passages(query text, match_count int default 8)
returns table (
  passage_id uuid,
  resource_id uuid,
  resource_title text,
  resource_author text,
  resource_type text,
  page_number int,
  passage_index int,
  snippet text,
  content text,
  rank real
)
language sql stable security invoker set search_path = public as $$
  select p.id, r.id, r.title, r.author, r.type, p.page_number, p.passage_index,
         ts_headline('english', p.content, websearch_to_tsquery('english', query),
                     'StartSel=<<, StopSel=>>, MaxWords=40, MinWords=15, MaxFragments=2'),
         p.content,
         ts_rank(p.search, websearch_to_tsquery('english', query))
  from public.knowledge_passages p
  join public.knowledge_resources r on r.id = p.resource_id
  where p.search @@ websearch_to_tsquery('english', query)
  order by 10 desc
  limit greatest(1, least(match_count, 50));
$$;

create or replace function public.search_memories(query text, match_count int default 8)
returns setof public.memories
language sql stable security invoker set search_path = public as $$
  select * from public.memories m
  where m.status = 'verified'
    and m.search @@ websearch_to_tsquery('english', query)
  order by ts_rank(m.search, websearch_to_tsquery('english', query)) desc, m.importance desc
  limit greatest(1, least(match_count, 50));
$$;

revoke all on function public.search_passages(text, int) from anon;
revoke all on function public.search_memories(text, int) from anon;
grant execute on function public.search_passages(text, int) to authenticated;
grant execute on function public.search_memories(text, int) to authenticated;
