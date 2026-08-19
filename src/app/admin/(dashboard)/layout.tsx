import Link from "next/link";
import { logoutAction } from "../login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto whitespace-nowrap text-sm font-medium">
          <Link href="/admin" className="shrink-0">
            Dashboard
          </Link>
          <Link href="/admin/players" className="shrink-0">
            Spieler
          </Link>
          <Link href="/admin/casual" className="shrink-0">
            Modus A · Casual
          </Link>
          <Link href="/admin/league" className="shrink-0">
            Modus B · Liga-Abend
          </Link>
        </nav>
        <form action={logoutAction} className="shrink-0">
          <button type="submit" className="text-sm underline">
            Abmelden
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
