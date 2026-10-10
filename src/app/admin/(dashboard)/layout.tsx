import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-4 py-4 print:hidden">
        <nav className="mx-auto flex w-full max-w-xl text-sm font-medium">
          <Link
            href="/admin"
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/casual"
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            Casual
          </Link>
          <Link
            href="/admin/league"
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            Liga
          </Link>
          <Link
            href="/admin/players"
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            Spieler
          </Link>
          <Link
            href="/admin/achievements"
            className="flex min-h-11 flex-1 items-center justify-center"
          >
            Achievements
          </Link>
        </nav>
      </header>
      <main className="p-6 print:p-0">{children}</main>
    </div>
  );
}
