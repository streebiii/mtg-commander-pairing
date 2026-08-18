import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Organisator-Dashboard</h1>
      <div className="flex flex-col gap-2 text-sm">
        <Link className="underline" href="/admin/players">
          Spielerverwaltung
        </Link>
        <Link className="underline" href="/admin/casual">
          Modus A — Casual-Rechner + Zuteilung
        </Link>
        <Link className="underline" href="/admin/league">
          Modus B — Liga-Abend
        </Link>
        <Link className="underline" href="/pairings">
          Öffentliche Pairing-Ansicht (ohne Login)
        </Link>
      </div>
    </div>
  );
}
