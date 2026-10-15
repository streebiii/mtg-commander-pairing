"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/casual", label: "Casual" },
  { href: "/admin/league", label: "Liga" },
  { href: "/admin/ligaverwaltung", label: "Ligaverwaltung" },
  { href: "/admin/players", label: "Spieler" },
];

/**
 * Hauptnavigation des Organisator-Bereichs. Die aktive Seite ist
 * hervorgehoben und unterstrichen — wie die Reiter der Ligaverwaltung
 * (LigaTabs) —, damit man auf dem Handy nach dem Scrollen weiss, wo man ist.
 */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Organisator"
      className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-x-5 text-base sm:gap-x-0"
    >
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center border-b-2 sm:flex-1 ${
              active
                ? "border-foreground font-semibold"
                : "border-transparent font-medium opacity-70 hover:opacity-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
