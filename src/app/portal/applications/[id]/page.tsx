// User application detail — the shared read-only view, gated by RLS inside
// UserApplicationView. Phase 10b-2: same generateStaticParams removal as the
// admin route — see that file's comment.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import UserApplicationView from "@/components/UserApplicationView";
import { PORTAL_ROLES } from "@/lib/session";

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

export default async function PortalApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect={PORTAL_ROLES}>
      <UserApplicationView id={id} />
    </AppShell>
  );
}
