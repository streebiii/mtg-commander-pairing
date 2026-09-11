import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { rankValues } from "@/lib/pairing/leagueRanking";
import { startEvening } from "./actions";
import DiscardEveningButton from "./DiscardEveningButton";
import FinishEveningButton from "./FinishEveningButton";
import ImportClient from "./ImportClient";
import LeaguePlayerRow from "./LeaguePlayerRow";
import NextRoundButton from "./NextRoundButton";
import PlayerSelectionList from "./PlayerSelectionList";
import PublishRoundButton from "./PublishRoundButton";
import RegenerateButton from "./RegenerateButton";
import RoundBoard from "./RoundBoard";

export const dynamic = "force-dynamic";

// Zwei Spiele pro Liga-Abend, so steht es in den Regeln auf mtgbl.ch.
const MAX_ROUNDS = 2;

export default async function LeaguePage() {
  // Unabhängige Top-Level-Abfragen parallel starten statt nacheinander zu
  // warten — spart bei jedem Seitenaufbau (auch nach jeder Aktion durch
  // revalidatePath) eine volle Round-Trip-Latenz zur DB.
  const [eveningResult, allPlayers] = await Promise.all([
    prisma.evening.findFirst({
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
    }),
    // Alle Vereinsspieler für die Verwaltung (Punkte + Teilnahme-Flag) —
    // nicht nur die aktuell teilnehmenden, damit man auch neue Spieler
    // aktivieren kann (siehe SPEC.md Abschnitt 6).
    prisma.player.findMany({
      where: { archivedAt: null },
      orderBy: [{ points: "desc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        points: true,
        attendedEvenings: true,
        leagueActive: true,
      },
    }),
  ]);
  let evening = eveningResult;

  // Ein "laufender" Abend ohne jede Runde ist ein verwaister Datensatz —
  // z.B. wenn früher das Anlegen von Abend und Runde 1 nicht atomar war
  // und der zweite Schritt fehlschlug (siehe startEvening in actions.ts).
  // Ohne diese Absicherung stürzt die Seite weiter unten beim Zugriff
  // auf `lastRound.tables` ab, dauerhaft — es gäbe dann ja auch keinen
  // Knopf mehr, um ihn manuell zu verwerfen. Selbstheilend aufräumen und
  // so tun, als gäbe es keinen laufenden Abend.
  if (evening && evening.rounds.length === 0) {
    await prisma.evening.delete({ where: { id: evening.id } });
    evening = null;
  }

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
              <th className="py-2 pr-3">Abende</th>
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
            <PlayerSelectionList
              players={activePlayers.map((p) => ({
                id: p.id,
                name: formatPlayerName(p),
                points: p.points,
              }))}
            />
          )}
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
        const isPublished = round.publishedAt !== null;

        // Warteraum: die jeweils letzte Runde, solange noch nicht live
        // geschaltet — der Organisator prüft/tauscht in Ruhe, bevor die
        // Spieler die Zuteilung sehen (siehe Grill-Notizen).
        if (isLastRound && !isPublished) {
          const attendeeIds = new Set(
            round.tables.flatMap((t) => t.assignments.map((a) => a.playerId)),
          );
          const standings = allPlayers.filter((p) => attendeeIds.has(p.id));
          const nameById = new Map(standings.map((p) => [p.id, formatPlayerName(p)]));
          // Sieger der Vorrunde für eine realistische Rang-Vorschau bei
          // Runde 2 — bereits geladen, keine zusätzliche Abfrage nötig.
          const vorrunde = round.number > 1 ? evening.rounds[round.number - 2] : null;
          const sieger = new Set(
            vorrunde?.tables.flatMap((t) =>
              t.assignments.filter((a) => a.isWinner).map((a) => a.playerId),
            ) ?? [],
          );
          const ranked = rankValues(standings, sieger);

          return (
            <section key={round.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-medium">
                  Runde {round.number} — Warteraum
                </h2>
                <RegenerateButton roundId={round.id} roundNumber={round.number} />
              </div>
              <p className="text-xs opacity-70">
                Diese Zuteilung ist noch nicht auf der öffentlichen Seite
                sichtbar. Tippe zwei Spieler an, um sie zu tauschen. Passt
                alles: „Live schalten“.
              </p>
              <RoundBoard tables={round.tables} mode="draft" />
              <PublishRoundButton roundId={round.id} />

              <details className="text-xs opacity-70">
                <summary className="cursor-pointer">
                  Rangfolge zur Kontrolle (Paarungs-Basis, ohne Zufalls-Rauschen)
                </summary>
                <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {ranked.map((r, i) => (
                    <li key={r.id}>
                      {i + 1}. {nameById.get(r.id) ?? "?"}
                    </li>
                  ))}
                </ol>
              </details>
            </section>
          );
        }

        return (
          <section key={round.id} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">
              Runde {round.number} —{" "}
              {isLastRound
                ? "Sieger antippen, sobald ein Tisch fertig ist"
                : "Ergebnis"}
            </h2>
            {isLastRound && (
              <p className="text-xs opacity-70">
                Tippe zwei Spieler an, um sie zu tauschen. Tippe einen Spieler
                an und dann die Krone 👑, um ihn als Sieger zu markieren.
                Erreicht ein Tisch das Zeitlimit, endet die Partie ohne Sieger
                — dann „Unentschieden“ wählen. Nochmals dieselbe Auswahl
                antippen macht die Erfassung rückgängig.
              </p>
            )}
            {isLastRound ? (
              <RoundBoard tables={round.tables} mode="live" />
            ) : (
              <div className="flex flex-wrap gap-4">
                {round.tables.map((table) => (
                  <div
                    key={table.id}
                    className="w-full rounded border border-white/20 p-3 sm:w-64"
                  >
                    <div className="mb-2 text-sm font-semibold">
                      Tisch {table.tableNumber} ({table.size} Spieler)
                    </div>
                    <ul className="flex flex-col gap-2">
                      {table.assignments.map((a) => (
                        <li
                          key={a.id}
                          className="flex min-h-9 items-center gap-2 text-sm"
                        >
                          <span className="w-4 shrink-0" aria-hidden="true">
                            {a.isWinner ? "🏆" : ""}
                          </span>
                          <span className="truncate">
                            {formatPlayerName(a.player)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap gap-3">
        {lastRound.number < MAX_ROUNDS && (
          <NextRoundButton eveningId={evening.id} disabled={!lastRoundComplete} />
        )}
        {/* Bewusst nie durch fehlende Ergebnisse gesperrt: der Abend muss
            sich auch beenden lassen, wenn Runde 2 nicht (mehr) ausgewertet
            wird — z.B. weil an dem Abend keine Achievement-Punkte für
            Runde 2 vergeben werden. */}
        <FinishEveningButton eveningId={evening.id} disabled={false} />
        {noResultsAtAll && <DiscardEveningButton eveningId={evening.id} />}
      </div>
      {!lastRoundComplete && lastRound.number < MAX_ROUNDS && (
        <p className="text-xs opacity-70">
          Halte zuerst für jeden Tisch fest, wie er ausgegangen ist — Sieger
          oder unentschieden —, bevor du die nächste Runde startest.
        </p>
      )}

      {managementSection}
    </div>
  );
}
