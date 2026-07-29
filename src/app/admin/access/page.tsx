import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AccessMatrix from "@/components/admin/AccessMatrix";
import RoleAssignment from "@/components/admin/RoleAssignment";
import ActivityLog from "@/components/admin/ActivityLog";

export const metadata: Metadata = { title: "User access" };

export default function AdminAccessPage() {
  return (
    <AppShell expect="admin">
      <RoleAssignment />
      <AccessMatrix />
      <ActivityLog />
    </AppShell>
  );
}
