"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/people/directory", label: "Directory" },
  { href: "/admin/people/access", label: "Access" },
  { href: "/admin/people/activity", label: "Activity" },
];

export default function PeopleTabNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="People sections" className="mt-7 flex gap-5 border-b border-ash/20">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-3 text-sm transition ${
              active ? "border-signal font-bold text-signal" : "border-transparent font-medium text-ash hover:text-bone"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
