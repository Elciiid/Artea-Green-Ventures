import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AccessMatrix from "@/components/admin/AccessMatrix";

export const metadata: Metadata = { title: "Access" };

export default function AdminAccessPage() {
  return (
    <AppShell expect="admin">
      <AccessMatrix />
    </AppShell>
  );
}
