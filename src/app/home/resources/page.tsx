import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import ResourcesPage from "@/components/home/ResourcesPage";

export const metadata: Metadata = { title: "Resources" };

export default function HomeResourcesPage() {
  return (
    <AppShell expect={["admin", "staff"]}>
      <ResourcesPage />
    </AppShell>
  );
}
