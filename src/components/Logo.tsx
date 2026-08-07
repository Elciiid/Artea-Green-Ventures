import Image from "next/image";
import logoGreen from "../../public/images/Logos/Artea Logo Assets-08.png";
import logoWhite from "../../public/images/Logos/Artea Logo Assets-09.png";

// Reskinned to match artea-green-glow (docs/superpowers/plans/2026-08-07-
// artea-green-glow-reskin.md) — per direct user correction, using the full
// AGV + tree-mark lockup (Assets-08/-09), not the text-only "Logotype"
// files an earlier pass picked. "green" (Assets-08) is AppShell's normal
// light-background header; "white" (Assets-09) is Home's dark hero header
// and footer (see AppShell's heroHeader prop and SiteFooter.tsx).
export function Wordmark({ variant = "green" }: { variant?: "green" | "white" }) {
  const logo = variant === "white" ? logoWhite : logoGreen;
  return (
    <Image
      src={logo}
      alt="Artea Green Ventures"
      priority
      className="h-8 w-auto sm:h-9"
    />
  );
}
