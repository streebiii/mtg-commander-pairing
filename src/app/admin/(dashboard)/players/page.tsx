import { prisma } from "@/lib/prisma";
import { createPlayer, deletePlayer, updatePlayer } from "./actions";

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
            Name
            <input
              type="text"
              name="name"
              required
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
          <button
            type="submit"
            className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            Anlegen
          </button>
        </form>
        <p className="text-xs opacity-70">
          Hier trägst du die aktuelle Saison-Rangliste (Name + Punktestand)
          einmalig manuell ein (siehe SPEC.md Abschnitt 7).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Bestehende Spieler ({players.length})
        </h2>
        <table className="w-full max-w-2xl text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-1 pr-2">Name</th>
              <th className="py-1 pr-2">Punkte</th>
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
                      name="name"
                      defaultValue={player.name}
                      className="w-40 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                    />
                    <input
                      type="number"
                      name="points"
                      defaultValue={player.points}
                      className="w-24 rounded border border-black/20 px-2 py-1 dark:border-white/20"
                    />
                    <button
                      type="submit"
                      className="rounded border border-black/20 px-2 py-1 text-xs dark:border-white/20"
                    >
                      Speichern
                    </button>
                  </form>
                </td>
                <td className="py-1 pr-2 align-middle">{player.points}</td>
                <td className="py-1 pr-2 align-middle">
                  {player._count.assignments}
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
                    <span className="text-xs opacity-50" title="Spieler hat bereits an Abenden teilgenommen">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
