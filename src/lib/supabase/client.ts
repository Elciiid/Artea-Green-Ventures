import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Uses the public URL + anon key (safe to ship in
// the bundle — the anon key is designed for client use and is gated by RLS).
// The service_role key must NEVER appear here or anywhere client-side.
//
// A single instance is reused so the auth session listener isn't duplicated.

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in the project URL and anon key."
    );
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
