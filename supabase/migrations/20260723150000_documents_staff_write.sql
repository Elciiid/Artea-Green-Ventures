-- Phase 10b-3d fix — staff was missing write access to agv_documents.
--
-- The 10b-3a migration added staff write policies for agv_applications and
-- agv_activity_entries but missed agv_documents, so uploadDocument()'s
-- metadata UPDATE was silently affecting 0 rows (PostgREST returns 200 with
-- an empty array on an RLS-blocked UPDATE, not an error) even though the
-- Storage file upload itself succeeded first. Caught during 10b-3d
-- verification: the upload showed a success toast, but the document stayed
-- "pending" and a direct check confirmed 0 rows affected.

drop policy if exists "documents — staff write granted" on public.agv_documents;
create policy "documents — staff write granted" on public.agv_documents
  for update using (agv_is_staff() and agv_has_app_access(application_id))
             with check (agv_is_staff() and agv_has_app_access(application_id));
