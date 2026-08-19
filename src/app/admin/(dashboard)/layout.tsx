import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <nav className="flex gap-6 text-sm font-medium">
          <Link href="/admin/casual" className="flex min-h-9 items-center">
            Casual
          </Link>
          <Link href="/admin/league" className="flex min-h-9 items-center">
            Liga
          </Link>
          <Link href="/admin/players" className="flex min-h-9 items-center">
            Spieler
          </Link>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
