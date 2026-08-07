import Image from "next/image";
import logoWhite from "../../../../public/images/Logos/Artea Logo Assets-09.png";
import sdgLogo from "../../../../public/images/SDP n News/E_SDG_logo_without_UN_emblem_Square_WEB.png-700x414.png";

// Ported from artea-green-glow's SiteFooter, replacing AppShell's normal
// simple footer on /home only (see AppShell's hideFooter prop). The
// Company/Legal columns are the reference's own placeholder anchors
// (href="#") — those pages don't exist in this app either, and inventing
// fake destinations for them would be worse than an honest non-link. The
// Portal column IS real navigation, since those routes genuinely exist.
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
      { label: "About Artea", href: "#" },
      { label: "Sustainability", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Modern slavery statement", href: "#" },
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
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm font-light text-rail-ink/75 transition-colors hover:text-rail-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-rail-ink/12 pt-6 text-xs font-light text-rail-ink/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Artea Green Ventures. All rights reserved.</p>
          <p>Sydney &middot; Manila</p>
        </div>
      </div>
    </footer>
  );
}
