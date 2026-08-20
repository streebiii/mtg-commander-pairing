import { prisma } from "@/lib/prisma";
import { SKILL_LEVEL_OPTIONS } from "@/lib/players";
import { createPlayer } from "./actions";
import PlayerRow from "./PlayerRow";

// Admin-Seiten lesen immer den aktuellen DB-Stand, kein statisches Caching.
export const dynamic = "force-dynamic";

// Allgemeine Vereins-Spielerverwaltung: Name + Elo. Liga-Punkte und die
// Liga-Teilnahme-Auswahl leben separat im Liga-Tab (siehe SPEC.md
// Abschnitt 6) — nicht jeder Vereinsspieler nimmt an der Liga teil.
export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Spielerverwaltung</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Neuen Spieler anlegen</h2>
        <form action={createPlayer} className="flex flex-wrap items-end gap-3">
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Vorname
            <input
              type="text"
              name="firstName"
              required
              className="min-h-9 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 sm:w-auto"
            />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Nachname (optional)
            <input
              type="text"
              name="lastName"
              className="min-h-9 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 sm:w-auto"
            />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Elo (0-3)
            <select
              name="skillLevel"
              defaultValue={0}
              className="min-h-9 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 sm:w-48"
            >
              {SKILL_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 w-full rounded bg-foreground px-4 py-2 text-sm font-medium text-background sm:w-auto"
          >
            Anlegen
          </button>
        </form>
        <p className="text-xs opacity-70">
          Neu angelegte Spieler nehmen noch nicht automatisch an der Liga
          teil — das wird separat im Liga-Tab aktiviert. Die Elo-Einstufung
          (verdecktes Rating, nur hier im Organisator-Bereich sichtbar) wird
          nur für den skill-balancierten Casual-Modus verwendet (siehe
          SPEC.md Abschnitt 4.1).
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          Bestehende Spieler ({players.length})
        </h2>
        <p className="text-xs opacity-70">
          Änderungen werden automatisch gespeichert, sobald du ein Feld
          verlässt bzw. eine Auswahl änderst.
        </p>
        {/* Auf schmalen Bildschirmen (Handy) horizontal scrollbar, statt
            Spalten einfach abzuschneiden. */}
        <div className="w-full max-w-3xl overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="py-2 pr-3">Vorname</th>
                <th className="py-2 pr-3">Nachname</th>
                <th className="py-2 pr-3">Elo</th>
                <th className="py-2 pr-3">Abende</th>
                <th className="py-2 pr-3"></th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  player={{
                    id: player.id,
                    firstName: player.firstName,
                    lastName: player.lastName,
                    skillLevel: player.skillLevel,
                    assignmentCount: player._count.assignments,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
