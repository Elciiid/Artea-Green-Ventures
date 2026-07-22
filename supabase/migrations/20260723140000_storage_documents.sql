-- Phase 10b-3d — Storage: a private bucket for application documents, with
-- policies mirroring the same access logic as the database RLS (10b-1/3a),
-- not a looser boundary.
--
-- Path convention: every object lives at "{application_id}/{document_id}-
-- {filename}" — the first path segment is always the application's real
-- uuid, so storage.foldername(name) lets these policies reuse the exact
-- same agv_has_app_access()/agv_is_admin()/agv_is_staff() predicates the
-- table RLS already uses. This bucket is entirely managed by this app's own
-- upload code, which always writes that path shape — no arbitrary
-- user-supplied paths ever reach it.
--
-- Bucket is created here via SQL (insert into storage.buckets) rather than
-- a manual dashboard step, so it applies the same way every other migration
-- in this project does.

insert into storage.buckets (id, name, public)
values ('agv-documents', 'agv-documents', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by default in every Supabase
-- project — no alter table needed here.

drop policy if exists "agv-documents — admin all" on storage.objects;
create policy "agv-documents — admin all" on storage.objects
  for all using (bucket_id = 'agv-documents' and agv_is_admin())
  with check (bucket_id = 'agv-documents' and agv_is_admin());

drop policy if exists "agv-documents — read granted" on storage.objects;
create policy "agv-documents — read granted" on storage.objects
  for select using (
    bucket_id = 'agv-documents'
    and agv_has_app_access(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "agv-documents — staff upload granted" on storage.objects;
create policy "agv-documents — staff upload granted" on storage.objects
  for insert with check (
    bucket_id = 'agv-documents'
    and agv_is_staff()
    and agv_has_app_access(((storage.foldername(name))[1])::uuid)
  );
