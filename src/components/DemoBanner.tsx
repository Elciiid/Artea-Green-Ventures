import { showDevTools } from "@/lib/session";

// A slim banner marking non-production environments. Fail-safe: shown only when
// showDevTools() confirms this isn't real production, so a "sample data" notice
// can never linger over a real deployment (and, conversely, can't be dropped
// from a hosted demo by a forgotten env var — same gate as the dev tools).

export default function DemoBanner() {
  if (!showDevTools()) return null;
  return (
    <aside
      aria-label="Environment notice"
      className="relative z-20 border-b border-amber/40 bg-amber/10 px-6 py-1.5 text-center text-label font-semibold uppercase tracking-[0.12em] text-amber"
    >
      Demo environment — sample data, not for real records
    </aside>
  );
}
