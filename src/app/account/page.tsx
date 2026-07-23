import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AccountSettings from "@/components/AccountSettings";

export const metadata: Metadata = { title: "Account" };

// /account is shared by both roles — no `expect`, so AppShell only requires a
// signed-in session, not a specific role.
export default function AccountPage() {
  return (
    <AppShell>
      <AccountSettings />
    </AppShell>
  );
}
