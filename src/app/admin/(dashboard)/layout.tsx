import Link from "next/link";
import { logoutAction } from "../login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/players">Spieler</Link>
          <Link href="/admin/casual">Modus A · Casual</Link>
          <Link href="/admin/league">Modus B · Liga-Abend</Link>
        </nav>
        <form action={logoutAction}>
          <button type="submit" className="text-sm underline">
            Abmelden
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
