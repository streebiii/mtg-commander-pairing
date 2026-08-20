import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Organisator-Dashboard</h1>
      <div className="flex flex-col gap-3 text-sm">
        <Link className="flex min-h-11 items-center underline" href="/admin/players">
          Spielerverwaltung
        </Link>
        <Link className="flex min-h-11 items-center underline" href="/admin/casual">
          Modus A — Casual-Rechner + Zuteilung
        </Link>
        <Link className="flex min-h-11 items-center underline" href="/admin/league">
          Modus B — Liga-Abend
        </Link>
        <Link className="flex min-h-11 items-center underline" href="/">
          Öffentliche Pairing-Ansicht (ohne Login)
        </Link>
      </div>
    </div>
  );
}
