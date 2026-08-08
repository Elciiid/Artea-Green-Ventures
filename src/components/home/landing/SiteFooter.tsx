import Image from "next/image";
import logoWhite from "../../../../public/images/Logos/Artea Logo Assets-09.png";
import sdgLogo from "../../../../public/images/SDP n News/E_SDG_logo_without_UN_emblem_Square_WEB.png-700x414.png";

// Ported from artea-green-glow's SiteFooter, replacing AppShell's normal
// simple footer on /home only (see AppShell's hideFooter prop). The Portal
// column is real in-app navigation, unchanged.
//
// Company column (2026-08-08): pointed at the real, live pages on
// arteagreenventures.com instead of the reference's placeholder href="#"s.
// "About Artea" and "Sustainability" both land on /who-we-are — AGV's real
// site doesn't split those into separate pages; that one page is where
// their mission/vision and UN SDGs + 3Ps + Circular Economy commitments
// actually live. "Careers" was dropped outright: AGV has no careers page
// or hiring content anywhere on the real site, so there was nothing honest
// to link it to.
//
// Legal column: "Modern slavery statement" dropped — no such document
// exists on the real site. "Privacy" and "Terms" are left as non-linking
// placeholders (href="#") rather than pointed at any AGV page, since
// nothing on arteagreenventures.com is actually a privacy policy or terms
// of service to link to — same "don't invent a destination" rule the
// reference's own placeholder links already followed, just now applied
// deliberately instead of inherited by default.
const columns = [
  {
    title: "Portal",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Applications", href: "/portal" },
      { label: "People", href: "/admin/people" },
      { label: "Companies", href: "/admin/companies" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Artea", href: "https://www.arteagreenventures.com/who-we-are" },
      { label: "Sustainability", href: "https://www.arteagreenventures.com/who-we-are" },
      { label: "Contact", href: "https://www.arteagreenventures.com/contact-1" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-rail text-rail-ink">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Image src={logoWhite} alt="Artea Green Ventures" className="h-10 w-auto" />
            <p className="mt-6 max-w-sm text-sm font-light leading-relaxed text-rail-ink/70">
              Artea Green Ventures builds the measurement, assurance and reporting
              backbone for low-carbon construction and infrastructure.
            </p>
            <Image
              src={sdgLogo}
              alt="United Nations Sustainable Development Goals"
              className="mt-8 h-10 w-auto opacity-80"
            />
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="eyebrow text-signal-light">{column.title}</h3>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => {
                    const external = link.href.startsWith("http");
                    return (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="text-sm font-light text-rail-ink/75 transition-colors hover:text-rail-ink"
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-rail-ink/12 pt-6 text-xs font-light text-rail-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Artea Green Ventures. All rights reserved.</p>
          {/* Real office locations, per arteagreenventures.com/contact-1 and
              the official Company Profile PDF's back page — not "Sydney" /
              "Manila", which were never AGV's actual office cities. */}
          <p>Merrylands, NSW &middot; Floridablanca, Pampanga</p>
        </div>
      </div>
    </footer>
  );
}
