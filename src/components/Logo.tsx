import Image from "next/image";
import logoGreen from "../../public/images/Logos/Logotype - Forest Green.png";
import logoWhite from "../../public/images/Logos/Logotype - White.png";

// Reskinned to match artea-green-glow (docs/superpowers/plans/2026-08-07-
// artea-green-glow-reskin.md) — that reference splits the wordmark into a
// green variant (light backgrounds — its PortalShell header) and a white
// variant (dark backgrounds — its hero, which sits over a photo). Same
// split here: "green" for AppShell's light header, "white" for the Home
// hero once that's rebuilt in the landing-page phase.
export function Wordmark({ variant = "green" }: { variant?: "green" | "white" }) {
  const logo = variant === "white" ? logoWhite : logoGreen;
  return (
    <Image
      src={logo}
      alt="Artea Green Ventures"
      priority
      className="h-6 w-auto sm:h-7"
    />
  );
}
