import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import {
  finishEvening,
  startEvening,
  startNextRound,
  submitRoundResults,
} from "./actions";
import ReassignSelect from "./ReassignSelect";

export const dynamic = "force-dynamic";

const MAX_ROUNDS = 3;

export default async function LeaguePage() {
  const evening = await prisma.evening.findFirst({
    where: { mode: "LEAGUE", finishedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      rounds: {
        orderBy: { number: "asc" },
        include: {
          tables: {
            orderBy: { tableNumber: "asc" },
            include: {
              assignments: {
                include: { player: true },
                orderBy: [
                  { player: { firstName: "asc" } },
                  { player: { lastName: "asc" } },
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!evening) {
    const players = await prisma.player.findMany({
      orderBy: { points: "desc" },
      select: { id: true, firstName: true, lastName: true, points: true },
    });
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">Modus B — Liga-Abend</h1>
          <p className="text-sm opacity-70">
            Pairing anhand der Gesamt-Liga-Rangliste, bis zu 3 Runden pro
            Abend (siehe SPEC.md Abschnitt 5).
          </p>
        </div>
        <form action={startEvening} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Anwesende Spieler auswählen
          </h2>
          <div className="flex max-w-2xl flex-wrap gap-2">
            {players.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-1 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
              >
                <input type="checkbox" name="playerIds" value={p.id} />
                {formatPlayerName(p)} ({p.points})
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="w-fit rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            Abend starten — Runde 1 berechnen
          </button>
        </form>
      </div>
    );
  }

  const lastRound = evening.rounds[evening.rounds.length - 1];
  const lastRoundComplete = lastRound.tables.every((t) =>
    t.assignments.every((a) => a.pointsAwarded !== null),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Modus B — Liga-Abend (laufend)</h1>
        <p className="text-sm opacity-70">
          Gestartet am {evening.date.toLocaleString("de-CH")}
        </p>
      </div>

      {evening.rounds.map((round) => (
        <form key={round.id} action={submitRoundResults} className="flex flex-col gap-3">
          <input type="hidden" name="roundId" value={round.id} />
          <h2 className="text-sm font-medium">
            Runde {round.number} — Punkte pro Spieler eintragen
          </h2>
          <div className="flex flex-wrap gap-4">
            {round.tables.map((table) => (
              <div
                key={table.id}
                className="w-64 rounded border border-black/20 p-3 dark:border-white/20"
              >
                <div className="mb-2 text-sm font-semibold">
                  Tisch {table.tableNumber} ({table.size} Spieler)
                </div>
                <ul className="flex flex-col gap-2">
                  {table.assignments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="w-20 truncate">
                        {formatPlayerName(a.player)}
                      </span>
                      <input
                        type="number"
                        name={`points_${a.id}`}
                        defaultValue={a.pointsAwarded ?? ""}
                        placeholder="Pkt."
                        className="w-16 rounded border border-black/20 px-1 py-0.5 dark:border-white/20"
                      />
                      {round.number === evening.rounds.length && (
                        <ReassignSelect
                          assignmentId={a.id}
                          currentTableId={table.id}
                          tables={round.tables}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="w-fit rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20"
          >
            Ergebnisse Runde {round.number} speichern
          </button>
        </form>
      ))}

      <div className="flex gap-3">
        {lastRound.number < MAX_ROUNDS && (
          <form action={startNextRound}>
            <input type="hidden" name="eveningId" value={evening.id} />
            <button
              type="submit"
              disabled={!lastRoundComplete}
              className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
            >
              Nächste Runde starten
            </button>
          </form>
        )}
        <form action={finishEvening}>
          <input type="hidden" name="eveningId" value={evening.id} />
          <button
            type="submit"
            disabled={!lastRoundComplete}
            className="rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20 disabled:opacity-40"
          >
            Abend beenden
          </button>
        </form>
      </div>
      {!lastRoundComplete && (
        <p className="text-xs opacity-70">
          Trage zuerst alle Ergebnisse der aktuellen Runde ein, bevor du die
          nächste Runde startest oder den Abend beendest.
        </p>
      )}
    </div>
  );
}
