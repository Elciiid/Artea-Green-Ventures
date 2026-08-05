import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import CompaniesAdmin from "@/components/admin/CompaniesAdmin";

export const metadata: Metadata = { title: "Companies" };

export default function CompaniesPage() {
  return (
    <AppShell expect="admin" boundedContent>
      <CompaniesAdmin />
    </AppShell>
  );
}
