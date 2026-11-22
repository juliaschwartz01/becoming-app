-- =====================================================================
-- Becoming — private file storage
-- Run after the first migration (SQL Editor → New query → paste → Run).
--
-- Creates three PRIVATE buckets. Nothing in them is publicly reachable:
-- files are only readable by the signed-in owner through short-lived signed links.
-- Every file must live in a folder named after the owner's user id:
--     <user-id>/<file>
--
--   knowledge      → documents, books, videos and screenshots for the Knowledge Library
--   vision-images  → images I chose to keep for vision boards (uploads + finished AI images)
--   attachments    → optional journal attachments
--
-- Temporary reference photos of me (for future AI image generation) are NEVER
-- uploaded to any bucket. They stay in the browser tab only.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('knowledge', 'knowledge', false, 52428800),       -- 50 MB per file (free plan maximum)
  ('vision-images', 'vision-images', false, 20971520), -- 20 MB per file
  ('attachments', 'attachments', false, 20971520)
on conflict (id) do update set public = false;

drop policy if exists "becoming_owner_read" on storage.objects;
drop policy if exists "becoming_owner_insert" on storage.objects;
drop policy if exists "becoming_owner_update" on storage.objects;
drop policy if exists "becoming_owner_delete" on storage.objects;

create policy "becoming_owner_read" on storage.objects for select to authenticated
  using (bucket_id in ('knowledge','vision-images','attachments')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "becoming_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('knowledge','vision-images','attachments')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "becoming_owner_update" on storage.objects for update to authenticated
  using (bucket_id in ('knowledge','vision-images','attachments')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "becoming_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('knowledge','vision-images','attachments')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
