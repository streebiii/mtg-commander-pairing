"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import { assignLeagueRound } from "@/lib/pairing/leagueAssignment";
import {
  RANG_RAUSCHEN,
  TAUSCH_TOLERANZ_RAENGE,
  rankValues,
} from "@/lib/pairing/leagueRanking";
import { buildPreviousPairings } from "@/lib/pairing/leagueHistory";
import { clearCasualPairing } from "@/lib/casualPairing";

/**
 * Zwei Runden pro Liga-Abend — so steht es in den Liga-Regeln auf
 * mtgbl.ch ("Pro Liga-Abend werden zwei Spiele gespielt").
 */
const MAX_ROUNDS = 2;


/**
 * Auto-Save für die Liga-Verwaltung: Punktestand und Liga-Teilnahme-Flag
 * eines Spielers. Die Teilnahme-Flag wirkt rein zukunftsgerichtet (siehe
 * SPEC.md Abschnitt 6) — sie filtert nur die Auswahlliste für neue
 * Liga-Abende, bestehende Abende/Ergebnisse bleiben unberührt.
 */
export async function updateLeaguePlayer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const pointsRaw = String(formData.get("points") ?? "").trim();
  const points = Number.parseInt(pointsRaw, 10);
  const leagueActive = formData.get("leagueActive") === "true";

  if (!id || !Number.isFinite(points)) return;

  await prisma.player.update({
    where: { id },
    data: { points, leagueActive },
  });
  revalidatePath("/admin/league");
}

/**
 * @param db Übergibt entweder `prisma` direkt oder einen Transaktions-
 *   Client — Aufrufer, die den Abend selbst gerade erst anlegen (siehe
 *   `startEvening`), müssen beides atomar tun, sonst bliebe bei einem
 *   Fehler zwischen den beiden Schritten ein Abend ohne jede Runde
 *   zurück. Genau das ist einmal in Produktion passiert: die Liga-Seite
 *   liest `evening.rounds[evening.rounds.length - 1]` und stürzte beim
 *   Zugriff auf `.tables` einer so entstandenen `undefined`-Runde ab —
 *   dauerhaft, denn ohne eine sichtbare Seite gibt es auch keinen Knopf
 *   mehr, um den kaputten Abend zu verwerfen.
 */
async function createRoundInDb(
  db: Prisma.TransactionClient | typeof prisma,
  eveningId: string,
  roundNumber: number,
  tables: string[][],
) {
  await db.round.create({
    data: {
      eveningId,
      number: roundNumber,
      tables: {
        create: tables.map((players, i) => ({
          tableNumber: i + 1,
          size: players.length,
          assignments: {
            create: players.map((playerId) => ({ playerId })),
          },
        })),
      },
    },
  });
}

/** Startet einen neuen Liga-Abend (Modus B) mit Runde 1. */
export async function startEvening(formData: FormData) {
  const playerIds = formData.getAll("playerIds").map(String);
  if (playerIds.length < 3) return;

  const active = await prisma.evening.findFirst({
    where: { mode: "LEAGUE", finishedAt: null },
  });
  if (active) return; // es läuft bereits ein Abend — erst beenden

  // leagueActive: true zur Sicherheit auch hier geprüft (nicht nur in der
  // UI-Auswahlliste) — nur Liga-teilnehmende Spieler dürfen in einen
  // Liga-Abend aufgenommen werden (siehe SPEC.md Abschnitt 6).
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, leagueActive: true, archivedAt: null },
    select: { id: true, points: true, attendedEvenings: true },
  });
  if (players.length !== playerIds.length) return;

  const sizes = computeTableSizes(players.length);
  // Runde 1: nach der Rangfolge, keine Historie, noch keine Sieger.
  const tables = assignLeagueRound(
    rankValues(players),
    sizes,
    new Set(),
    RANG_RAUSCHEN,
    TAUSCH_TOLERANZ_RAENGE,
  );

  // Abend + Runde 1 atomar anlegen (siehe createRoundInDb) — sonst bliebe
  // bei einem Fehler zwischen den beiden Schritten ein Abend ohne jede
  // Runde zurück, der die Liga-Seite dauerhaft zum Absturz bringt.
  await prisma.$transaction(async (tx) => {
    const evening = await tx.evening.create({ data: { mode: "LEAGUE" } });
    await createRoundInDb(tx, evening.id, 1, tables);
  });

  // Öffentlich wird immer nur eines gezeigt — eine offene Casual-Zuteilung
  // würde den Liga-Abend sonst verdecken (siehe SPEC.md Abschnitt 4).
  await clearCasualPairing();

  revalidatePath("/admin/league");
  revalidatePath("/");
}

/**
 * Hält fest, wie ein Tisch ausgegangen ist: mit einem Sieger oder
 * unentschieden.
 *
 * Der Sieg ist der Sortierschlüssel für die zweite Runde (siehe
 * BACKLOG.md) — und die einzige Angabe, die direkt nach der Partie
 * vorliegt. Die Achievement-Punkte stehen erst am Abendende auf dem
 * abgegebenen Zettel und taugen deshalb nicht zum Paaren.
 *
 * `winnerAssignmentId` leer bedeutet unentschieden: bei Erreichen des
 * Zeitlimits von 120 Minuten endet die Partie ohne Sieger (Liga-Regeln
 * auf mtgbl.ch), dann zählen alle an diesem Tisch als ohne Sieg.
 *
 * Nochmals dieselbe Auswahl antippen macht die Erfassung rückgängig —
 * der Tisch gilt danach wieder als "noch nicht erfasst".
 */
export async function setTableResult(formData: FormData) {
  const tableId = String(formData.get("tableId") ?? "");
  const winnerAssignmentId = String(formData.get("winnerAssignmentId") ?? "");
  if (!tableId) return;

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      assignments: { select: { id: true, isWinner: true } },
      round: {
        include: {
          evening: {
            include: {
              rounds: { orderBy: { number: "desc" }, take: 1, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!table) return;
  if (table.round.evening.finishedAt) return;
  // Nur die jeweils letzte Runde ist noch änderbar: auf dem Ergebnis von
  // Runde 1 beruht bereits die Paarung von Runde 2.
  if (table.round.evening.rounds[0]?.id !== table.roundId) return;
  // Sieger ergeben erst Sinn, sobald die Runde öffentlich sichtbar ist —
  // vorher sitzen die Spieler ja noch nicht am (angezeigten) Tisch. Der
  // Warteraum dient nur der Kontrolle/dem Tausch der Zuteilung.
  if (!table.round.publishedAt) return;

  const bisherigerSieger = table.assignments.find((a) => a.isWinner)?.id ?? "";
  if (winnerAssignmentId && !table.assignments.some((a) => a.id === winnerAssignmentId)) {
    return;
  }

  const istWiderruf =
    table.resultEnteredAt !== null && winnerAssignmentId === bisherigerSieger;

  await prisma.$transaction([
    prisma.tableAssignment.updateMany({
      where: { tableId },
      data: { isWinner: false },
    }),
    ...(istWiderruf || !winnerAssignmentId
      ? []
      : [
          prisma.tableAssignment.update({
            where: { id: winnerAssignmentId },
            data: { isWinner: true },
          }),
        ]),
    prisma.table.update({
      where: { id: tableId },
      data: { resultEnteredAt: istWiderruf ? null : new Date() },
    }),
  ]);

  revalidatePath("/admin/league");
}

/**
 * Berechnet und erstellt Runde 2 (mehr Runden gibt es pro Abend nicht).
 * Gepaart wird nach dem Sieg aus Runde 1, nicht nach dem Saisonstand.
 */
export async function startNextRound(formData: FormData) {
  const eveningId = String(formData.get("eveningId") ?? "");
  if (!eveningId) return;

  const evening = await prisma.evening.findUnique({
    where: { id: eveningId },
    include: {
      rounds: {
        orderBy: { number: "desc" },
        take: 1,
        include: { tables: { include: { assignments: true } } },
      },
    },
  });
  if (!evening || evening.finishedAt) return;

  const lastRound = evening.rounds[0];
  if (!lastRound) return;
  if (lastRound.number >= MAX_ROUNDS) return;

  // Für jeden Tisch muss feststehen, wie er ausgegangen ist — mit Sieger
  // oder unentschieden. "Noch nicht erfasst" blockiert.
  const allEntered = lastRound.tables.every((t) => t.resultEnteredAt !== null);
  if (!allEntered) return;

  // Runde 2 paart nach derselben Rangfolge wie Runde 1, aber die Sieger
  // rücken um SIEG_BONUS_RAENGE nach oben — sie treffen damit auf die
  // Sieger ihrer Umgebung, nicht auf die Ligaspitze. Ging ein Tisch
  // unentschieden aus, zählen alle dort als ohne Sieg.
  const attendeeIds = lastRound.tables.flatMap((t) =>
    t.assignments.map((a) => a.playerId),
  );
  const sieger = new Set(
    lastRound.tables.flatMap((t) =>
      t.assignments.filter((a) => a.isWinner).map((a) => a.playerId),
    ),
  );
  const standings = await prisma.player.findMany({
    where: { id: { in: attendeeIds } },
    select: { id: true, points: true, attendedEvenings: true },
  });

  const sizes = computeTableSizes(standings.length);
  const previousPairings = await buildPreviousPairings(eveningId);
  const tables = assignLeagueRound(
    rankValues(standings, sieger),
    sizes,
    previousPairings,
    RANG_RAUSCHEN,
    TAUSCH_TOLERANZ_RAENGE,
  );

  await createRoundInDb(prisma, eveningId, lastRound.number + 1, tables);
  revalidatePath("/admin/league");
}

/**
 * Würfelt die Tischzuteilung einer Runde neu aus (gleicher Spieler-Pool,
 * neue Zufallsziehung inkl. Rang-Jitter, siehe SPEC.md Abschnitt 5.1).
 * Nur für die jeweils letzte Runde eines Abends möglich, und nur solange
 * sie noch im Warteraum ist (nicht veröffentlicht) — einmal live, hängen
 * ggf. schon Ergebnisse dran, und die Spieler kennen ihren Tisch bereits.
 */
export async function regenerateRound(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      evening: { include: { rounds: { orderBy: { number: "desc" }, take: 1 } } },
      tables: { include: { assignments: true } },
    },
  });
  if (!round) return;

  const isLastRound = round.evening.rounds[0]?.id === round.id;
  if (!isLastRound) return;

  if (round.publishedAt) return;

  const attendeeIds = round.tables.flatMap((t) =>
    t.assignments.map((a) => a.playerId),
  );
  const players = await prisma.player.findMany({
    where: { id: { in: attendeeIds } },
    select: { id: true, points: true, attendedEvenings: true },
  });

  // Beim Neuwürfeln von Runde 2 zählen die Sieger der Vorrunde weiterhin —
  // sonst käme eine Zuteilung heraus, die nach anderen Regeln entstanden
  // wäre als die, die sie ersetzt.
  const vorrunde =
    round.number > 1
      ? await prisma.tableAssignment.findMany({
          where: {
            isWinner: true,
            table: { round: { eveningId: round.eveningId, number: round.number - 1 } },
          },
          select: { playerId: true },
        })
      : [];
  const sieger = new Set(vorrunde.map((a) => a.playerId));

  const sizes = computeTableSizes(players.length);
  const previousPairings = await buildPreviousPairings(
    round.eveningId,
    round.number,
  );
  const tables = assignLeagueRound(
    rankValues(players, sieger),
    sizes,
    previousPairings,
    RANG_RAUSCHEN,
    TAUSCH_TOLERANZ_RAENGE,
  );

  await prisma.$transaction([
    prisma.table.deleteMany({ where: { roundId: round.id } }),
    ...tables.map((tablePlayers, i) =>
      prisma.table.create({
        data: {
          roundId: round.id,
          tableNumber: i + 1,
          size: tablePlayers.length,
          assignments: { create: tablePlayers.map((playerId) => ({ playerId })) },
        },
      }),
    ),
  ]);

  revalidatePath("/admin/league");
}

/**
 * Tauscht zwei Spieler zwischen (oder innerhalb) ihrer Tische — ersetzt
 * das frühere Tisch-Auswahl-Dropdown durch Antippen (siehe
 * Grill-Notizen): zwei Spieler antippen statt einen Tisch aus einer
 * Liste zu wählen, analog zum Casual-Tab.
 *
 * Funktioniert unabhängig vom Warteraum-/Live-Status der Runde — nur
 * die jeweils letzte Runde eines laufenden Abends ist überhaupt
 * änderbar.
 *
 * Bewusst kein Zurücksetzen von `isWinner`/`resultEnteredAt` beim
 * Tausch: das gab es beim alten Dropdown genauso wenig. Wer nach einer
 * Sieger-Erfassung noch tauscht, muss das Ergebnis ggf. selbst
 * korrigieren — ein seltener Sonderfall, kein neues Verhalten.
 */
export async function swapPlayers(formData: FormData) {
  const assignmentAId = String(formData.get("assignmentAId") ?? "");
  const assignmentBId = String(formData.get("assignmentBId") ?? "");
  if (!assignmentAId || !assignmentBId || assignmentAId === assignmentBId) return;

  const [a, b] = await Promise.all([
    prisma.tableAssignment.findUnique({
      where: { id: assignmentAId },
      select: {
        tableId: true,
        table: {
          select: {
            roundId: true,
            round: {
              select: {
                eveningId: true,
                evening: {
                  select: {
                    finishedAt: true,
                    rounds: { orderBy: { number: "desc" }, take: 1, select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.tableAssignment.findUnique({
      where: { id: assignmentBId },
      select: { tableId: true, table: { select: { roundId: true } } },
    }),
  ]);
  if (!a || !b) return;
  // Beide müssen in derselben Runde sitzen — und nur die jeweils letzte
  // Runde eines noch laufenden Abends ist änderbar.
  if (a.table.roundId !== b.table.roundId) return;
  if (a.table.round.evening.finishedAt) return;
  if (a.table.round.evening.rounds[0]?.id !== a.table.roundId) return;
  if (a.tableId === b.tableId) return; // gleicher Tisch — nichts zu tauschen

  await prisma.$transaction([
    prisma.tableAssignment.update({
      where: { id: assignmentAId },
      data: { tableId: b.tableId },
    }),
    prisma.tableAssignment.update({
      where: { id: assignmentBId },
      data: { tableId: a.tableId },
    }),
  ]);
  revalidatePath("/admin/league");
}

/**
 * Schaltet eine Runde live: ab jetzt sieht die öffentliche Seite diese
 * Zuteilung statt der vorherigen, und Sieger lassen sich erfassen
 * (siehe setTableResult). Vorher war sie nur im Organisator-Warteraum
 * sichtbar — Absicht: Tische in Ruhe kontrollieren/tauschen, bevor die
 * Spieler sie sehen.
 */
export async function publishRound(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      evening: { include: { rounds: { orderBy: { number: "desc" }, take: 1 } } },
    },
  });
  if (!round) return;
  if (round.evening.finishedAt) return;
  if (round.evening.rounds[0]?.id !== round.id) return;
  if (round.publishedAt) return; // schon live

  await prisma.round.update({
    where: { id: roundId },
    data: { publishedAt: new Date() },
  });

  revalidatePath("/admin/league");
  revalidatePath("/");
}

/** Beendet den aktuellen Liga-Abend (keine weiteren Runden mehr möglich). */
export async function finishEvening(formData: FormData) {
  const eveningId = String(formData.get("eveningId") ?? "");
  if (!eveningId) return;

  await prisma.evening.update({
    where: { id: eveningId },
    data: { finishedAt: new Date() },
  });
  revalidatePath("/admin/league");
}
