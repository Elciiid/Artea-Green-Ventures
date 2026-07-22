// Admin application detail — renders the shared ApplicationDetail with
// edit controls (status select, add note) via AdminApplicationView.
// Phase 10b-2: no more generateStaticParams off mock data — the register now
// reads real Supabase rows, so build-time params would drift from reality.
// Vercel builds don't have DB connectivity by design (see the
// migrate-deploy removal), so params are resolved per-request instead.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AdminApplicationView from "@/components/admin/AdminApplicationView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {
    // malformed percent-encoding — fall back to the raw id
  }
  return { title: clean };
}

export default async function AdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect="admin">
      <AdminApplicationView id={id} />
    </AppShell>
  );
}
