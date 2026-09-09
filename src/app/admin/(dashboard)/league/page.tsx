import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import {
  finishEvening,
  setTableResult,
  startEvening,
  startNextRound,
} from "./actions";
import DiscardEveningButton from "./DiscardEveningButton";
import ImportClient from "./ImportClient";
import LeaguePlayerRow from "./LeaguePlayerRow";
import ReassignSelect from "./ReassignSelect";
import RegenerateButton from "./RegenerateButton";

export const dynamic = "force-dynamic";

// Zwei Spiele pro Liga-Abend, so steht es in den Regeln auf mtgbl.ch.
const MAX_ROUNDS = 2;

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
            Zwei Runden pro Abend. Runde 1 wird nach dem Saisonstand
            gepaart, Runde 2 nach den Siegern der ersten Runde.
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
  // Vollständig ist eine Runde, wenn für jeden Tisch feststeht, wie er
  // ausgegangen ist — mit Sieger oder unentschieden.
  const lastRoundComplete = lastRound.tables.every(
    (t) => t.resultEnteredAt !== null,
  );
  // Solange nirgends ein Ergebnis steht, lässt sich der Abend komplett
  // verwerfen — sonst käme man aus einem Fehlstart nicht mehr heraus.
  const noResultsAtAll = evening.rounds.every((r) =>
    r.tables.every((t) => t.resultEnteredAt === null),
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
        const roundHasNoResults = round.tables.every(
          (t) => t.resultEnteredAt === null,
        );
        return (
          <section key={round.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-medium">
                Runde {round.number} —{" "}
                {isLastRound
                  ? "Sieger antippen, sobald ein Tisch fertig ist"
                  : "Ergebnis"}
              </h2>
              {isLastRound && roundHasNoResults && (
                <RegenerateButton roundId={round.id} roundNumber={round.number} />
              )}
            </div>
            {isLastRound && (
              <p className="text-xs opacity-70">
                Erreicht ein Tisch das Zeitlimit, endet die Partie ohne Sieger
                — dann „Unentschieden“ wählen. Nochmals dieselbe Auswahl
                antippen macht die Erfassung rückgängig.
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {round.tables.map((table) => {
                const sieger = table.assignments.find((a) => a.isWinner);
                const erfasst = table.resultEnteredAt !== null;
                return (
                  <div
                    key={table.id}
                    className={`w-full rounded border p-3 sm:w-64 ${
                      erfasst ? "border-white/20" : "border-amber-500/60"
                    }`}
                  >
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">
                        Tisch {table.tableNumber} ({table.size} Spieler)
                      </span>
                      <span className="shrink-0 text-xs opacity-70">
                        {!erfasst
                          ? "offen"
                          : sieger
                            ? "Sieger steht"
                            : "unentschieden"}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {table.assignments.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          {isLastRound ? (
                            <form action={setTableResult} className="flex-1">
                              <input type="hidden" name="tableId" value={table.id} />
                              <input
                                type="hidden"
                                name="winnerAssignmentId"
                                value={a.id}
                              />
                              <button
                                type="submit"
                                className={`flex min-h-11 w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
                                  a.isWinner
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-white/10"
                                }`}
                              >
                                <span className="w-4 shrink-0" aria-hidden="true">
                                  {a.isWinner ? "🏆" : ""}
                                </span>
                                <span className="truncate">
                                  {formatPlayerName(a.player)}
                                </span>
                              </button>
                            </form>
                          ) : (
                            <span className="flex min-h-9 flex-1 items-center gap-2 text-sm">
                              <span className="w-4 shrink-0" aria-hidden="true">
                                {a.isWinner ? "🏆" : ""}
                              </span>
                              <span className="truncate">
                                {formatPlayerName(a.player)}
                              </span>
                            </span>
                          )}
                          {isLastRound && (
                            <ReassignSelect
                              assignmentId={a.id}
                              currentTableId={table.id}
                              tables={round.tables}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                    {isLastRound && (
                      <form action={setTableResult} className="mt-2">
                        <input type="hidden" name="tableId" value={table.id} />
                        <input type="hidden" name="winnerAssignmentId" value="" />
                        <button
                          type="submit"
                          className={`min-h-11 w-full rounded border px-3 py-2 text-sm ${
                            erfasst && !sieger
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-dashed border-white/20"
                          }`}
                        >
                          Unentschieden
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
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
          Halte zuerst für jeden Tisch fest, wie er ausgegangen ist — Sieger
          oder unentschieden —, bevor du die nächste Runde startest oder den
          Abend beendest.
        </p>
      )}

      {managementSection}
    </div>
  );
}
