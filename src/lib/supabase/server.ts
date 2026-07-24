// Server-only Supabase clients for Route Handlers. Never import this file
// from a "use client" component — SUPABASE_SERVICE_ROLE_KEY has no
// NEXT_PUBLIC_ prefix, so Next.js never inlines it into a client bundle; a
// client-side import would just see `undefined` and throw immediately below.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  return url;
}

/**
 * Anon-key client for use inside a Route Handler. Pass the caller's own
 * access token (from their `Authorization: Bearer <token>` header) to have
 * Postgres RLS evaluate `auth.uid()` as that caller — this client never
 * bypasses RLS, regardless of the token passed.
 */
export function getSupabaseServerClient(accessToken?: string): SupabaseClient {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient(
    getUrl(),
    anonKey,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : undefined
  );
}

/**
 * service_role client — bypasses RLS entirely. Only ever call this after
 * independently verifying the caller is allowed to do whatever this client
 * is about to do; RLS can't help you here.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local for dev and in " +
        "your host's project env vars for prod — never commit it, never put it " +
        "in a NEXT_PUBLIC_ variable."
    );
  }
  return createClient(getUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
