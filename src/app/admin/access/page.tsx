import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AccessMatrix from "@/components/admin/AccessMatrix";

export const metadata: Metadata = { title: "User access" };

export default function AdminAccessPage() {
  return (
    <AppShell expect="admin">
      <AccessMatrix />
    </AppShell>
  );
}
