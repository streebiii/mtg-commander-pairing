import { prisma } from "@/lib/prisma";
import { SKILL_LEVEL_OPTIONS } from "@/lib/players";
import { createPlayer, deletePlayer, updatePlayer } from "./actions";
import ImportClient from "./ImportClient";

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
        <table className="w-full max-w-2xl text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-1 pr-2">Vorname</th>
              <th className="py-1 pr-2">Nachname</th>
              <th className="py-1 pr-2">Punkte</th>
              <th className="py-1 pr-2">Skill</th>
              <th className="py-1 pr-2">Abende</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-1 pr-2">
                  <form
                    action={updatePlayer}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="id" value={player.id} />
                    <input
                      type="text"
                      name="firstName"
                      defaultValue={player.firstName}
                      className="w-32 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                    />
                    <input
                      type="text"
                      name="lastName"
                      defaultValue={player.lastName ?? ""}
                      placeholder="(optional)"
                      className="w-32 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                    />
                    <input
                      type="number"
                      name="points"
                      defaultValue={player.points}
                      className="w-20 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                    />
                    <select
                      name="skillLevel"
                      defaultValue={player.skillLevel}
                      className="w-14 rounded border border-black/20 px-1 py-1 dark:border-white/20"
                    >
                      {SKILL_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value}
                        </option>
                      ))}
                    </select>
                    <span className="w-16 text-xs opacity-70">
                      {player._count.assignments} Abend(e)
                    </span>
                    <button
                      type="submit"
                      className="rounded border border-black/20 px-2 py-1 text-xs dark:border-white/20"
                    >
                      Speichern
                    </button>
                  </form>
                </td>
                <td className="py-1 align-middle">
                  {player._count.assignments === 0 ? (
                    <form action={deletePlayer}>
                      <input type="hidden" name="id" value={player.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 underline"
                      >
                        Löschen
                      </button>
                    </form>
                  ) : (
                    <span
                      className="text-xs opacity-50"
                      title="Spieler hat bereits an Abenden teilgenommen"
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
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
