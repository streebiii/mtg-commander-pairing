import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import TableCard from "@/components/TableCard";
import { MAX_ROUNDS } from "@/lib/pairing/leagueAssignment";
import { rankValues } from "@/lib/pairing/leagueRanking";
import { loadPairingStandings } from "@/lib/rankingData";
import { startEvening } from "./actions";
import AttendancePanel from "./AttendancePanel";
import Sidebar from "@/components/Sidebar";
import EntryBanner from "./EntryBanner";
import LeagueInfo from "./LeagueInfo";
import FinishEveningButton from "./FinishEveningButton";
import NextRoundButton from "./NextRoundButton";
import PlayerSelectionList from "./PlayerSelectionList";
import PublishRoundButton from "./PublishRoundButton";
import RegenerateButton from "./RegenerateButton";
import RoundBoard from "./RoundBoard";

export const dynamic = "force-dynamic";

export default async function LeaguePage() {
  // Unabhängige Top-Level-Abfragen parallel starten statt nacheinander zu
  // warten — spart bei jedem Seitenaufbau (auch nach jeder Aktion durch
  // revalidatePath) eine volle Round-Trip-Latenz zur DB.
  const [eveningResult, allPlayers] = await Promise.all([
    prisma.evening.findFirst({
      where: { finishedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        lateArrivals: { include: { player: true }, orderBy: { createdAt: "asc" } },
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
    // Die Liga-Teilnehmenden — Auswahl beim Start und Nachzügler. Wer
    // teilnimmt, legst du im Spieler-Tab fest (SPEC.md Abschnitt 6).
    prisma.player.findMany({
      where: { archivedAt: null, leagueActive: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
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

  const activePlayers = allPlayers;

  // Rangfolge für die Paarung (SPEC.md Abschnitt 5.1) — für die Punkte in
  // der Auswahl vor dem Start bzw. die Rang-Vorschau im Warteraum.
  const attendeeIdsOfEvening = evening
    ? [
        ...new Set(
          evening.rounds.flatMap((r) =>
            r.tables.flatMap((t) => t.assignments.map((a) => a.playerId)),
          ),
        ),
      ]
    : activePlayers.map((p) => p.id);
  const preview = await loadPairingStandings(attendeeIdsOfEvening);
  const standingById = new Map(preview.map((p) => [p.id, p]));

  if (!evening) {
    return (
      <div className="flex flex-col gap-4">
        <LeagueInfo />
        {activePlayers.length === 0 ? (
          <p className="text-base opacity-70">
            Noch keine Spieler als Liga-teilnehmend markiert — nimm im
            Spieler-Tab welche auf.
          </p>
        ) : (
          <form action={startEvening}>
            <PlayerSelectionList
              players={activePlayers.map((p) => ({
                id: p.id,
                name: formatPlayerName(p),
                points: standingById.get(p.id)?.points ?? 0,
              }))}
              sidebarExtra={<EntryBanner />}
            />
          </form>
        )}
      </div>
    );
  }

  const lastRound = evening.rounds[evening.rounds.length - 1];
  const lastRoundPublished = lastRound.publishedAt !== null;
  // Vollständig ist eine Runde, wenn für jeden Tisch feststeht, wie er
  // ausgegangen ist — mit Sieger oder unentschieden.
  const lastRoundComplete = lastRound.tables.every(
    (t) => t.resultEnteredAt !== null,
  );
  // An den Anwesenden lässt sich etwas ändern, bis Runde 2 live ist (siehe
  // SPEC.md Abschnitt 5.3) — danach ändert ein Drop an keiner Paarung mehr
  // etwas.
  const attendanceOpen = !(lastRound.number >= MAX_ROUNDS && lastRoundPublished);
  const attendancePhase =
    lastRound.number === 1
      ? lastRoundPublished
        ? "round1Live"
        : "round1Draft"
      : "round2Draft";
  const firstRoundAssignments = evening.rounds[0].tables.flatMap((t) => t.assignments);
  const droppedPlayers = firstRoundAssignments
    .filter((a) => a.droppedAt !== null)
    .map((a) => ({ id: a.playerId, name: formatPlayerName(a.player) }));
  const inEvening = new Set([
    ...evening.rounds.flatMap((r) =>
      r.tables.flatMap((t) => t.assignments.map((a) => a.playerId)),
    ),
    ...evening.lateArrivals.map((l) => l.playerId),
  ]);
  const lateArrivalCandidates = activePlayers
    .filter((p) => !inEvening.has(p.id))
    .map((p) => ({ id: p.id, name: formatPlayerName(p) }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  const startedAt = evening.date.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
  // Die aktuelle Runde zuoberst — wie die Tischzuteilung im Casual-Tab:
  // beim Spielabend schaut man darauf, nicht auf die Vorrunde.
  const roundsNewestFirst = [...evening.rounds].reverse();

  return (
    <div className="flex flex-col gap-4">
      <LeagueInfo subtitle={`Abend läuft · gestartet ${startedAt}`} />

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="flex flex-col gap-8 lg:col-span-3">
          {roundsNewestFirst.map((round) => {
            const isLastRound = round.id === lastRound.id;
            const isPublished = round.publishedAt !== null;

            // Warteraum: die jeweils letzte Runde, solange noch nicht live
            // geschaltet — der Organisator prüft/tauscht in Ruhe, bevor die
            // Spieler die Zuteilung sehen.
            if (isLastRound && !isPublished) {
              const attendeeIds = new Set(
                round.tables.flatMap((t) => t.assignments.map((a) => a.playerId)),
              );
              const standings = preview.filter((p) => attendeeIds.has(p.id));
              const nameById = new Map(
                round.tables.flatMap((t) =>
                  t.assignments.map((a) => [a.playerId, formatPlayerName(a.player)] as const),
                ),
              );
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
                    <h2 className="text-lg font-medium">
                      Runde {round.number} — Warteraum
                    </h2>
                    <PublishRoundButton roundId={round.id} />
                  </div>
                  <p className="text-base opacity-70">
                    Diese Zuteilung ist noch nicht öffentlich sichtbar. Tippe
                    zwei Spieler an, um sie zu tauschen. Passt alles: «Live
                    schalten».
                  </p>
                  <RoundBoard
                    tables={round.tables}
                    mode="draft"
                    eveningId={attendanceOpen ? evening.id : undefined}
                  />
                  <details className="text-base opacity-70">
                    <summary className="cursor-pointer">
                      Rangfolge zur Kontrolle (Basis der Teilung in eine obere und eine untere Hälfte)
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
                <h2 className="text-lg font-medium">
                  Runde {round.number} — {isLastRound ? "live" : "Ergebnis"}
                </h2>
                {isLastRound && (
                  <p className="text-base opacity-70">
                    Ist ein Tisch fertig: Spieler antippen und die Krone 👑,
                    oder «Unentschieden» bei Zeitlimit. Nochmals dieselbe
                    Auswahl antippen macht es rückgängig. Zwei Spieler
                    antippen tauscht sie.
                  </p>
                )}
                {isLastRound ? (
                  <RoundBoard
                    tables={round.tables}
                    mode="live"
                    eveningId={attendanceOpen ? evening.id : undefined}
                  />
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {round.tables.map((table) => (
                      <TableCard key={table.id} tableNumber={table.tableNumber} size={table.size}>
                        <ul className="flex flex-col gap-2">
                          {table.assignments.map((a) => (
                            <li key={a.id} className="flex min-h-9 items-center gap-2 text-base">
                              <span className="w-4 shrink-0" aria-hidden="true">
                                {a.isWinner ? "🏆" : ""}
                              </span>
                              <span
                                className={`truncate ${a.droppedAt ? "line-through opacity-60" : ""}`}
                              >
                                {formatPlayerName(a.player)}
                              </span>
                              {a.droppedAt && (
                                <span className="shrink-0 text-base opacity-70">gedroppt</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </TableCard>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <Sidebar>
          <h2 className="text-lg font-medium">Abend</h2>
          <p className="text-base">
            Runde {lastRound.number} von {MAX_ROUNDS} ·{" "}
            {!lastRoundPublished
              ? "im Warteraum"
              : lastRoundComplete
                ? "alle Tische erfasst"
                : `${lastRound.tables.filter((t) => t.resultEnteredAt === null).length} Tische offen`}
          </p>

          <div className="flex flex-col gap-2">
            {!lastRoundPublished && (
              <RegenerateButton roundId={lastRound.id} roundNumber={lastRound.number} />
            )}
            {lastRoundPublished && lastRound.number < MAX_ROUNDS && (
              <>
                <NextRoundButton eveningId={evening.id} disabled={!lastRoundComplete} />
                {!lastRoundComplete && (
                  <p className="text-base opacity-70">
                    Erst wenn für jeden Tisch Sieger oder Unentschieden
                    feststeht.
                  </p>
                )}
              </>
            )}
            {/* Bewusst nie durch fehlende Ergebnisse gesperrt: der Abend
                muss sich auch beenden lassen, wenn Runde 2 nicht (mehr)
                gespielt wird. Die Rückfrage warnt dann. */}
            <FinishEveningButton
              eveningId={evening.id}
              roundsMissing={MAX_ROUNDS - lastRound.number + (lastRoundPublished ? 0 : 1)}
            />
          </div>

          {attendanceOpen && (
            <AttendancePanel
              eveningId={evening.id}
              phase={attendancePhase}
              dropped={droppedPlayers}
              lateArrivals={evening.lateArrivals.map((l) => ({
                id: l.playerId,
                name: formatPlayerName(l.player),
              }))}
              candidates={lateArrivalCandidates}
            />
          )}

          <EntryBanner />
        </Sidebar>
      </div>
    </div>
  );
}
