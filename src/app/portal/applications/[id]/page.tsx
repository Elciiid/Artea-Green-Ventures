// User application detail — the shared read-only view, gated by the user's
// visibility list inside UserApplicationView.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import UserApplicationView from "@/components/UserApplicationView";
import { APPLICATIONS } from "@/lib/mock-data";

export function generateStaticParams() {
  return APPLICATIONS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let clean = id;
  try {
    clean = decodeURIComponent(id);
  } catch {}
  const app = APPLICATIONS.find((a) => a.id.toLowerCase() === clean.toLowerCase());
  return { title: app ? app.id : "Not available" };
}

export default async function PortalApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect="user">
      <UserApplicationView id={id} />
    </AppShell>
  );
}
