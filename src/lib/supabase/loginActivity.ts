// Sign-in/sign-up activity (tab 1). See the API route's file header for why
// this needs a server route rather than a direct client query — auth.users
// isn't reachable through RLS/PostgREST at all, backend or not.

export type LoginActivityEntry = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
};

export async function fetchLoginActivity(): Promise<LoginActivityEntry[]> {
  const res = await fetch("/api/admin/activity/logins");
  const body = await res.json().catch(() => ({}) as { error?: string; entries?: unknown });
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Couldn't load sign-in activity (${res.status}).`);
  }
  return (body as { entries: LoginActivityEntry[] }).entries;
}
