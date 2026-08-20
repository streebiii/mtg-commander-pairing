import { prisma } from "@/lib/prisma";
import { SKILL_LEVELS } from "@/lib/players";
import { createPlayer } from "./actions";
import PlayerRow from "./PlayerRow";

// Admin-Seiten lesen immer den aktuellen DB-Stand, kein statisches Caching.
export const dynamic = "force-dynamic";

// Zentrale Vereins-Spielerverwaltung: Name, Elo und Liga-Teilnahme. Die
// Liga-Punkte werden bewusst nur im Liga-Tab gepflegt (siehe SPEC.md
// Abschnitt 6). Archivierte Spieler erscheinen hier nicht mehr.
export default async function PlayersPage() {
  const [players, runningAssignments] = await Promise.all([
    prisma.player.findMany({
      where: { archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    // Spieler, die gerade an einem Tisch eines laufenden Liga-Abends sitzen —
    // die dürfen nicht entfernt werden, sonst zerreisst es den Abend.
    prisma.tableAssignment.findMany({
      where: { table: { round: { evening: { finishedAt: null } } } },
      select: { playerId: true },
    }),
  ]);
  const inRunningEvening = new Set(runningAssignments.map((a) => a.playerId));

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
              className="min-h-9 w-full rounded border border-black/20 px-3 py-2 dark:border-white/20 sm:w-20"
            >
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 w-full items-center gap-2 text-sm sm:w-auto">
            <input type="checkbox" name="leagueActive" className="h-4 w-4" />
            Nimmt an der Liga teil
          </label>
          <button
            type="submit"
            className="min-h-11 w-full rounded bg-foreground px-4 py-2 text-sm font-medium text-background sm:w-auto"
          >
            Anlegen
          </button>
        </form>
        <p className="text-xs opacity-70">
          Die Elo-Einstufung ist ein verdecktes Rating und nur hier im
          Organisator-Bereich sichtbar — sie wird ausschliesslich für die
          elo-balancierte Zuteilung im Casual-Modus verwendet (siehe SPEC.md
          Abschnitt 4.1). Die Liga-Punkte pflegst du im Liga-Tab.
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
        <div className="w-full max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="py-2 pr-3">Vorname</th>
                <th className="py-2 pr-3">Nachname</th>
                <th className="py-2 pr-3">Elo</th>
                <th className="py-2 pr-3">Liga</th>
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
                    leagueActive: player.leagueActive,
                    inRunningEvening: inRunningEvening.has(player.id),
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs opacity-70">
          Löschen entfernt einen Spieler endgültig. Hat er bereits an Abenden
          teilgenommen, wird er stattdessen archiviert — er verschwindet aus
          allen Listen, die vergangenen Abende bleiben aber vollständig
          erhalten.
        </p>
      </section>
    </div>
  );
}
