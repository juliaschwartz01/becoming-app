-- =====================================================================
-- Becoming — security self-check (read-only, changes nothing)
-- Run in SQL Editor after the migrations. Every row should say "ok".
-- =====================================================================

select c.relname as table_name,
       case when c.relrowsecurity then 'ok' else 'RLS IS OFF' end as row_level_security,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

select id as bucket, case when public then 'PUBLIC — fix this' else 'ok (private)' end as status
from storage.buckets
where id in ('knowledge','vision-images','attachments');
