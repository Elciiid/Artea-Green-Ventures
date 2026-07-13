import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata: Metadata = { title: "Admin console" };

export default function AdminPage() {
  return (
    <AppShell expect="admin">
      <AdminDashboard />
    </AppShell>
  );
}
