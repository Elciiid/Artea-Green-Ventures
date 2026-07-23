import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import AnnouncementsPage from "@/components/home/AnnouncementsPage";

export const metadata: Metadata = { title: "Announcements" };

export default function HomeAnnouncementsPage() {
  return (
    <AppShell expect={["admin", "staff"]}>
      <AnnouncementsPage />
    </AppShell>
  );
}
