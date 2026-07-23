import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import DirectoryPage from "@/components/home/DirectoryPage";

export const metadata: Metadata = { title: "Staff directory" };

export default function HomeDirectoryPage() {
  return (
    <AppShell expect={["admin", "staff"]}>
      <DirectoryPage />
    </AppShell>
  );
}
