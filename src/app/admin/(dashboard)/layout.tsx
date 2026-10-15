import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/casual", label: "Casual" },
  { href: "/admin/league", label: "Liga" },
  { href: "/admin/ligaverwaltung", label: "Ligaverwaltung" },
  { href: "/admin/players", label: "Spieler" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-4 py-2 sm:py-4 print:hidden">
        <nav className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-x-5 text-base font-medium sm:gap-x-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center justify-center sm:flex-1"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-6 print:p-0">{children}</main>
    </div>
  );
}
