-- Close a live column-restriction gap on agv_applications — same class of
-- bug as the agv_profiles self-role-escalation fix (20260725100000).
--
-- "applications — staff write granted" (10b-3a) only checks row-level
-- access (agv_is_staff() and a live grant via agv_has_app_access(id)), not
-- which columns are being changed. A staff account with a grant on ONE
-- application can currently rewrite that row's organization_id, reference,
-- title, client_name, or any other field with no restriction — the 10b-3a
-- migration comment called this "an accepted scope cut," but that was never
-- actually surfaced as a real decision, so treat it as an open gap.
--
-- The app's only legitimate staff write path (changeApplicationStage, in
-- src/lib/supabase/applications.ts) ever sends { stage, status_note }. Fix:
-- a BEFORE UPDATE trigger that rejects a change to any OTHER column unless
-- the actor is already an admin or is running with no JWT at all
-- (auth.uid() is null — the service-role key), same allow-only-admin-or-
-- service-role shape as agv_prevent_self_role_escalation. updated_at is
-- deliberately excluded — it's expected to change on every legitimate
-- update via the existing agv_set_updated_at trigger.

create or replace function public.agv_prevent_staff_application_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.id              is distinct from old.id or
    new.reference        is distinct from old.reference or
    new.title            is distinct from old.title or
    new.service          is distinct from old.service or
    new.sector           is distinct from old.sector or
    new.location         is distinct from old.location or
    new.country          is distinct from old.country or
    new.coords           is distinct from old.coords or
    new.lead             is distinct from old.lead or
    new.client_name      is distinct from old.client_name or
    new.hero             is distinct from old.hero or
    new.submitted_at     is distinct from old.submitted_at or
    new.organization_id  is distinct from old.organization_id or
    new.created_at       is distinct from old.created_at
  ) then
    if auth.uid() is not null and not public.agv_is_admin() then
      raise exception 'Only admins may change this field on an application.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agv_applications_prevent_staff_tamper on public.agv_applications;
create trigger agv_applications_prevent_staff_tamper
  before update on public.agv_applications
  for each row execute function public.agv_prevent_staff_application_tamper();
