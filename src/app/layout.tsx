import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import PreferencesEffect from "@/components/PreferencesEffect";
import SupabaseAuthListener from "@/components/SupabaseAuthListener";
import ProfileSync from "@/components/ProfileSync";
import DemoBanner from "@/components/DemoBanner";
import AxeReporter from "@/components/dev/AxeReporter";

// Applies the saved text-size and theme preferences before first paint, so a
// person who needs larger text — or light mode — never sees a frame of the
// wrong one. Theme is written as the RESOLVED value, which is what the
// stylesheet keys off.
// Fallback is "light" (not "system") to match the store default from Phase 16
// — a first-time visitor with no saved preference gets light, and never a
// flash of dark on a dark-OS device.
const NO_FLASH = `try{var s=JSON.parse(localStorage.getItem("agv-demo-preferences")||"{}").state||{};var d=document.documentElement;if(s.textSize&&s.textSize!=="default"){d.dataset.textSize=s.textSize}var t=s.theme||"light";if(t==="system"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}d.dataset.theme=t}catch(e){}`;

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0F0C" },
    { media: "(prefers-color-scheme: light)", color: "#F4F1E8" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // the no-flash script sets data-theme / data-text-size on <html> before
      // hydration, so its attributes legitimately differ from the server HTML
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        {/* wrapped in a landmark so the link itself isn't orphaned content
            (axe "region" rule) */}
        <nav aria-label="Skip links">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
        </nav>
        <PreferencesEffect />
        <SupabaseAuthListener />
        <ProfileSync />
        {process.env.NODE_ENV === "development" && <AxeReporter />}
        <DemoBanner />
        {children}
        <div aria-hidden className="noise" />
      </body>
    </html>
  );
}
