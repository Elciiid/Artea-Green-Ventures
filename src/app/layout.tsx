import type { Metadata, Viewport } from "next";
import { Outfit, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SupabaseAuthListener from "@/components/SupabaseAuthListener";
import DemoBanner from "@/components/DemoBanner";
import AxeReporter from "@/components/dev/AxeReporter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AGV Home",
    template: "%s · AGV Home",
  },
  description:
    "Track environmental approvals for Artea Green Ventures, from the first submission to the final report.",
};

export const viewport: Viewport = {
  themeColor: "#F1F3F1",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* wrapped in a landmark so the link itself isn't orphaned content
            (axe "region" rule) */}
        <nav aria-label="Skip links">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
        </nav>
        <SupabaseAuthListener />
        {process.env.NODE_ENV === "development" && <AxeReporter />}
        {/* DemoBanner + the page content share the viewport via flex
            distribution (not two independent h-dvh claims) so a
            boundedContent page's "exactly viewport height" shell correctly
            fills what's left after the banner, instead of overflowing by
            the banner's own height. */}
        <div className="flex h-dvh flex-col">
          <DemoBanner />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TooltipProvider>{children}</TooltipProvider>
          </div>
        </div>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
