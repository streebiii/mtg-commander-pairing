import { prisma } from "@/lib/prisma";
import { SKILL_LEVEL_OPTIONS } from "@/lib/players";
import { createPlayer } from "./actions";
import ImportClient from "./ImportClient";
import PlayerRow from "./PlayerRow";

// Admin-Seiten lesen immer den aktuellen DB-Stand, kein statisches Caching.
export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await prisma.player.findMany({
    orderBy: { points: "desc" },
    include: { _count: { select: { assignments: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Spielerverwaltung</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Neuen Spieler anlegen</h2>
        <form action={createPlayer} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Vorname
            <input
              type="text"
              name="firstName"
              required
              className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nachname (optional)
            <input
              type="text"
              name="lastName"
              className="rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Punktestand (Start)
            <input
              type="number"
              name="points"
              defaultValue={0}
              required
              className="w-28 rounded border border-black/20 px-2 py-1 dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Skill (0-3)
            <select
              name="skillLevel"
              defaultValue={0}
              className="w-48 rounded border border-black/20 px-2 py-1 dark:border-white/20"
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
            className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            Anlegen
          </button>
        </form>
        <p className="text-xs opacity-70">
          Hier trägst du die aktuelle Saison-Rangliste einmalig manuell ein
          (siehe SPEC.md Abschnitt 7) — oder nutzt den Text-Import unten. Die
          Skill-Einstufung ist unabhängig davon und wird nur für den
          skill-balancierten Modus A verwendet (siehe SPEC.md Abschnitt 4.1).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Bestehende Spieler ({players.length})
        </h2>
        <p className="text-xs opacity-70">
          Änderungen werden automatisch gespeichert, sobald du ein Feld
          verlässt bzw. eine Auswahl änderst.
        </p>
        <table className="w-full max-w-3xl text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-1 pr-2">Vorname</th>
              <th className="py-1 pr-2">Nachname</th>
              <th className="py-1 pr-2">Punkte</th>
              <th className="py-1 pr-2">Skill</th>
              <th className="py-1 pr-2">Abende</th>
              <th className="py-1 pr-2"></th>
              <th className="py-1"></th>
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
                  points: player.points,
                  skillLevel: player.skillLevel,
                  assignmentCount: player._count.assignments,
                }}
              />
            ))}
          </tbody>
        </table>
      </section>

      <ImportClient
        existingPlayers={players.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          points: p.points,
        }))}
      />
    </div>
  );
}
