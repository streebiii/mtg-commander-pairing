"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/ligaverwaltung", label: "Aktuelle Runde", exact: true },
  { href: "/admin/ligaverwaltung/runden", label: "Runden" },
  { href: "/admin/ligaverwaltung/achievements", label: "Achievements" },
  { href: "/admin/ligaverwaltung/tischkarten", label: "Tischkarten" },
];

/**
 * Reiter der Ligaverwaltung (SPEC.md Abschnitt 14) — gestaltet wie die
 * Kategorie-Reiter im Achievement-Katalog. Die Grundlinie liegt auf dem
 * äusseren Element, damit die Unterstreichung beim seitlichen Scrollen
 * keinen Scrollbalken erzeugt.
 */
export default function LigaTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-white/10 print:hidden">
      <nav aria-label="Ligaverwaltung" className="flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 text-base transition-colors ${
                active
                  ? "border-foreground font-medium"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
