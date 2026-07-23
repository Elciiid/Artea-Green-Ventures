-- Phase 10b-3d fix #2 — storage.objects was missing a staff UPDATE policy.
--
-- uploadDocument() calls .upload(path, file, { upsert: true }) so a re-upload
-- to the same path (re-attempting a failed upload, or genuinely replacing a
-- file) works instead of erroring on a duplicate key. When the object
-- already exists, Supabase Storage's upsert performs an UPDATE on
-- storage.objects, not an INSERT — and the 10b-3d migration only added a
-- staff INSERT policy. Caught immediately after the first fix: a second
-- upload attempt to the same path (the same pending document, retried after
-- the agv_documents policy fix) failed with "new row violates row-level
-- security policy" — an UPDATE-shaped denial, not the INSERT case already
-- covered.

drop policy if exists "agv-documents — staff update granted" on storage.objects;
create policy "agv-documents — staff update granted" on storage.objects
  for update using (
    bucket_id = 'agv-documents'
    and agv_is_staff()
    and agv_has_app_access(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'agv-documents'
    and agv_is_staff()
    and agv_has_app_access(((storage.foldername(name))[1])::uuid)
  );
