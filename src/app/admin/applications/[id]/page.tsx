// Admin application detail — renders the shared ApplicationDetail with
// edit controls (status select, add note) via AdminApplicationView.

import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AdminApplicationView from "@/components/admin/AdminApplicationView";
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
  return { title: app ? app.id : "Application not found" };
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
