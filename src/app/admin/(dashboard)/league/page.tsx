import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import {
  finishEvening,
  startEvening,
  startNextRound,
  submitRoundResults,
} from "./actions";
import DiscardEveningButton from "./DiscardEveningButton";
import ImportClient from "./ImportClient";
import LeaguePlayerRow from "./LeaguePlayerRow";
import ReassignSelect from "./ReassignSelect";
import RegenerateButton from "./RegenerateButton";

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

  // Alle Vereinsspieler für die Verwaltung (Punkte + Teilnahme-Flag) — nicht
  // nur die aktuell teilnehmenden, damit man auch neue Spieler aktivieren
  // kann (siehe SPEC.md Abschnitt 6).
  const allPlayers = await prisma.player.findMany({
    where: { archivedAt: null },
    orderBy: [{ points: "desc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, points: true, leagueActive: true },
  });

  const managementSection = (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">
        Liga-Verwaltung ({allPlayers.length} Spieler)
      </h2>
      <p className="text-xs opacity-70">
        Punktestand und Liga-Teilnahme pro Spieler — nur teilnehmende Spieler
        erscheinen in der Auswahlliste für neue Liga-Abende. Änderungen
        werden automatisch gespeichert.
      </p>
      <div className="w-full max-w-2xl overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="py-2 pr-3">Spieler</th>
              <th className="py-2 pr-3">Punkte</th>
              <th className="py-2 pr-3">Liga-Teilnahme</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {allPlayers.map((player) => (
              <LeaguePlayerRow key={player.id} player={player} />
            ))}
          </tbody>
        </table>
      </div>
      <ImportClient
        existingPlayers={allPlayers.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
        }))}
      />
    </section>
  );

  if (!evening) {
    const activePlayers = allPlayers.filter((p) => p.leagueActive);
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold">Liga</h1>
          <p className="text-sm opacity-70">
            Pairing anhand der Gesamt-Liga-Rangliste, bis zu 3 Runden pro
            Abend (siehe SPEC.md Abschnitt 5).
          </p>
        </div>
        <form action={startEvening} className="flex flex-col gap-4">
          <h2 className="text-sm font-medium">
            Anwesende Spieler auswählen
          </h2>
          {activePlayers.length === 0 ? (
            <p className="text-xs opacity-70">
              Noch keine Spieler als Liga-teilnehmend markiert — aktiviere
              zuerst welche unten in der Liga-Verwaltung.
            </p>
          ) : (
            <div className="flex max-w-2xl flex-wrap gap-2">
              {activePlayers.map((p) => (
                <label
                  key={p.id}
                  className="flex min-h-9 items-center gap-1.5 rounded border border-white/20 px-3 py-2 text-sm"
                >
                  <input type="checkbox" name="playerIds" value={p.id} className="h-4 w-4" />
                  {formatPlayerName(p)} ({p.points})
                </label>
              ))}
            </div>
          )}
          <button
            type="submit"
            disabled={activePlayers.length < 3}
            className="min-h-11 w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Abend starten — Runde 1 berechnen
          </button>
        </form>

        {managementSection}
      </div>
    );
  }

  const lastRound = evening.rounds[evening.rounds.length - 1];
  const lastRoundComplete = lastRound.tables.every((t) =>
    t.assignments.every((a) => a.pointsAwarded !== null),
  );
  // Solange nirgends ein Ergebnis steht, lässt sich der Abend komplett
  // verwerfen — sonst käme man aus einem Fehlstart nicht mehr heraus.
  const noResultsAtAll = evening.rounds.every((r) =>
    r.tables.every((t) => t.assignments.every((a) => a.pointsAwarded === null)),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Liga (laufend)</h1>
        <p className="text-sm opacity-70">
          Gestartet am {evening.date.toLocaleString("de-CH")}
        </p>
      </div>

      {evening.rounds.map((round) => {
        const isLastRound = round.number === evening.rounds.length;
        const roundHasNoResults = round.tables.every((t) =>
          t.assignments.every((a) => a.pointsAwarded === null),
        );
        return (
        <form key={round.id} action={submitRoundResults} className="flex flex-col gap-3">
          <input type="hidden" name="roundId" value={round.id} />
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-medium">
              Runde {round.number} — Punkte pro Spieler eintragen
            </h2>
            {isLastRound && roundHasNoResults && (
              <RegenerateButton roundId={round.id} roundNumber={round.number} />
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {round.tables.map((table) => (
              <div
                key={table.id}
                className="w-full rounded border border-white/20 p-3 sm:w-64"
              >
                <div className="mb-2 text-sm font-semibold">
                  Tisch {table.tableNumber} ({table.size} Spieler)
                </div>
                <ul className="flex flex-col gap-2.5">
                  {table.assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-20 truncate">
                        {formatPlayerName(a.player)}
                      </span>
                      <input
                        type="number"
                        name={`points_${a.id}`}
                        defaultValue={a.pointsAwarded ?? ""}
                        placeholder="Pkt."
                        className="min-h-9 w-20 rounded border border-white/20 px-2 py-2"
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
            className="min-h-11 w-fit rounded border border-white/20 px-4 py-2 text-sm"
          >
            Ergebnisse Runde {round.number} speichern
          </button>
        </form>
        );
      })}

      <div className="flex flex-wrap gap-3">
        {lastRound.number < MAX_ROUNDS && (
          <form action={startNextRound}>
            <input type="hidden" name="eveningId" value={evening.id} />
            <button
              type="submit"
              disabled={!lastRoundComplete}
              className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
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
            className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm disabled:opacity-40"
          >
            Abend beenden
          </button>
        </form>
        {noResultsAtAll && <DiscardEveningButton eveningId={evening.id} />}
      </div>
      {!lastRoundComplete && (
        <p className="text-xs opacity-70">
          Trage zuerst alle Ergebnisse der aktuellen Runde ein, bevor du die
          nächste Runde startest oder den Abend beendest.
        </p>
      )}

      {managementSection}
    </div>
  );
}
