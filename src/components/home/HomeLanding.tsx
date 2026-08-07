// AGV Home landing (/home) — ported from artea-green-glow's index.tsx
// (docs/superpowers/plans/2026-08-07-artea-green-glow-reskin.md). The
// reference composes SiteHeader/SiteFooter around these same seven
// sections; here AppShell already supplies header/footer (reskinned to
// match — see AppShell.tsx), so this is just the section stack. Rendered
// with AppShell's fullBleed prop (see /app/home/page.tsx) so Hero can
// genuinely span the viewport width, not just AppShell's normal
// max-w-6xl content column.

import Hero from "@/components/home/landing/Hero";
import PressStrip from "@/components/home/landing/PressStrip";
import WorkspaceSection from "@/components/home/landing/WorkspaceSection";
import VideoFeature from "@/components/home/landing/VideoFeature";
import ClientsSection from "@/components/home/landing/ClientsSection";
import SdgSection from "@/components/home/landing/SdgSection";
import CtaSection from "@/components/home/landing/CtaSection";

export default function HomeLanding() {
  return (
    <>
      <Hero />
      <PressStrip />
      <WorkspaceSection />
      <VideoFeature />
      <ClientsSection />
      <SdgSection />
      <CtaSection />
    </>
  );
}
