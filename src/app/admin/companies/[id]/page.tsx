import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import CompanyDetail from "@/components/admin/CompanyDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Company · ${id}` };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell expect="admin" boundedContent>
      <CompanyDetail companyId={id} />
    </AppShell>
  );
}
