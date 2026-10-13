"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { assignLeagueRound, MAX_ROUNDS } from "@/lib/pairing/leagueAssignment";
import { rankValues } from "@/lib/pairing/leagueRanking";
import { loadEveningHistory } from "@/lib/pairing/leagueHistory";
import { clearCasualPairing } from "@/lib/casualPairing";
import { adoptAchievementsForEvening } from "@/lib/achievements";
import { loadPairingStandings } from "@/lib/rankingData";

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

/**
 * Wer in der Runde nach `roundNumber` gepaart wird: die Spieler dieser
 * Runde ohne die gedroppten, dazu die Nachzügler (siehe SPEC.md
 * Abschnitt 5.3).
 */
async function attendeesAfterRound(
  eveningId: string,
  roundNumber: number,
): Promise<string[]> {
  const [assignments, lateArrivals] = await Promise.all([
    prisma.tableAssignment.findMany({
      where: { table: { round: { eveningId, number: roundNumber } }, droppedAt: null },
      select: { playerId: true },
    }),
    prisma.lateArrival.findMany({
      where: { eveningId },
      select: { playerId: true },
    }),
  ]);
  return [
    ...new Set([
      ...assignments.map((a) => a.playerId),
      ...lateArrivals.map((l) => l.playerId),
    ]),
  ];
}

/**
 * Paart eine Runde. Runde 1 nach der Rangfolge allein; ab Runde 2 rücken
 * die Sieger der Vorrunde um SIEG_BONUS_RAENGE nach oben — das entscheidet
 * vor allem an der Grenze zwischen oberer und unterer Hälfte (siehe
 * assignLeagueRound in leagueAssignment.ts). Ging ein Tisch unentschieden
 * aus, zählen alle dort als ohne Sieg.
 */
async function pairRound(
  eveningId: string,
  roundNumber: number,
  attendeeIds: string[],
): Promise<string[][]> {
  const players = await loadPairingStandings(attendeeIds);
  if (roundNumber === 1) return assignLeagueRound(rankValues(players));

  const vorrunde = await prisma.tableAssignment.findMany({
    where: {
      isWinner: true,
      table: { round: { eveningId, number: roundNumber - 1 } },
    },
    select: { playerId: true },
  });
  const sieger = new Set(vorrunde.map((a) => a.playerId));
  const { previousPairings, wiederholteNichtVierer } = await loadEveningHistory(
    eveningId,
    roundNumber,
  );
  return assignLeagueRound(
    rankValues(players, sieger),
    previousPairings,
    wiederholteNichtVierer,
    sieger,
  );
}

/**
 * Mischt eine Runde im Warteraum neu. Runde 1 behält ihren Spieler-Pool
 * (oder bekommt `round1Attendees`, wenn sich die Anwesenden ändern); ab
 * Runde 2 gilt, wer nach der Vorrunde noch da ist (siehe
 * `attendeesAfterRound`). Beim Neuwürfeln von Runde 2 zählen die Sieger
 * der Vorrunde weiterhin — sonst käme eine Zuteilung heraus, die nach
 * anderen Regeln entstanden wäre als die, die sie ersetzt.
 */
async function rebuildDraftRound(
  round: {
    id: string;
    eveningId: string;
    number: number;
    tables: { assignments: { playerId: string }[] }[];
  },
  round1Attendees?: string[],
) {
  const attendeeIds =
    round.number === 1
      ? (round1Attendees ??
        round.tables.flatMap((t) => t.assignments.map((a) => a.playerId)))
      : await attendeesAfterRound(round.eveningId, round.number - 1);
  if (attendeeIds.length < 3) return;

  const tables = await pairRound(round.eveningId, round.number, attendeeIds);
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
}

/** Startet einen neuen Liga-Abend (Modus B) mit Runde 1. */
export async function startEvening(formData: FormData) {
  await requireAdmin();
  const playerIds = formData.getAll("playerIds").map(String);
  if (playerIds.length < 3) return;

  const active = await prisma.evening.findFirst({
    where: { finishedAt: null },
  });
  if (active) return; // es läuft bereits ein Abend — erst beenden

  // leagueActive: true zur Sicherheit auch hier geprüft (nicht nur in der
  // UI-Auswahlliste) — nur Liga-teilnehmende Spieler dürfen in einen
  // Liga-Abend aufgenommen werden (siehe SPEC.md Abschnitt 6).
  const eligible = await prisma.player.count({
    where: { id: { in: playerIds }, leagueActive: true, archivedAt: null },
  });
  if (eligible !== playerIds.length) return;

  // Runde 1: nach der Rangfolge, keine Historie, noch keine Sieger.
  const tables = assignLeagueRound(rankValues(await loadPairingStandings(playerIds)));

  // Abend + Runde 1 atomar anlegen (siehe createRoundInDb) — sonst bliebe
  // bei einem Fehler zwischen den beiden Schritten ein Abend ohne jede
  // Runde zurück, der die Liga-Seite dauerhaft zum Absturz bringt. Die
  // geltenden Achievements gehören mit in dieselbe Transaktion, damit es
  // keinen Abend ohne seine Achievements gibt.
  await prisma.$transaction(async (tx) => {
    // Eine noch offene Erfassung eines früheren Abends wird geschlossen:
    // es gibt immer nur eine offene Erfassung, sonst wäre die alte in der
    // Übersicht nicht mehr erreichbar (siehe SPEC.md Abschnitt 12).
    await tx.evening.updateMany({
      where: { entryClosedAt: null },
      data: { entryClosedAt: new Date() },
    });
    const evening = await tx.evening.create({ data: {} });
    await createRoundInDb(tx, evening.id, 1, tables);
    await adoptAchievementsForEvening(tx, evening.id);
  });

  // Öffentlich wird immer nur eines gezeigt — eine offene Casual-Zuteilung
  // würde den Liga-Abend sonst verdecken (siehe SPEC.md Abschnitt 4).
  await clearCasualPairing();

  revalidatePath("/admin/league");
  revalidatePath("/admin/ligaverwaltung/achievements");
  revalidatePath("/admin/ligaverwaltung");
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
  await requireAdmin();
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
  await requireAdmin();
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

  // Gedroppte fehlen ab jetzt, Nachzügler kommen dazu (siehe SPEC.md
  // Abschnitt 5.3).
  const attendeeIds = await attendeesAfterRound(eveningId, lastRound.number);
  if (attendeeIds.length < 3) return;
  const tables = await pairRound(eveningId, lastRound.number + 1, attendeeIds);

  await createRoundInDb(prisma, eveningId, lastRound.number + 1, tables);
  revalidatePath("/admin/league");
}

/**
 * Würfelt die Tischzuteilung einer Runde neu aus (gleicher Spieler-Pool,
 * neue Zufallsziehung innerhalb der beiden Hälften, siehe SPEC.md
 * Abschnitt 5.1).
 * Nur für die jeweils letzte Runde eines Abends möglich, und nur solange
 * sie noch im Warteraum ist (nicht veröffentlicht) — einmal live, hängen
 * ggf. schon Ergebnisse dran, und die Spieler kennen ihren Tisch bereits.
 */
export async function regenerateRound(formData: FormData) {
  await requireAdmin();
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

  await rebuildDraftRound(round);
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  const eveningId = String(formData.get("eveningId") ?? "");
  if (!eveningId) return;

  await prisma.evening.update({
    where: { id: eveningId },
    data: { finishedAt: new Date() },
  });
  revalidatePath("/admin/league");
  revalidatePath("/admin/ligaverwaltung/achievements");
}

/**
 * Der laufende Abend mit seiner letzten Runde — sofern sich an den
 * Anwesenden noch etwas ändern lässt: bis die letzte Runde des Abends
 * (Runde 2) live ist. Danach ändert ein Drop an der Paarung nichts mehr
 * (siehe SPEC.md Abschnitt 5.3).
 */
async function loadAttendanceContext(eveningId: string) {
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
  if (!evening || evening.finishedAt) return null;
  const lastRound = evening.rounds[0];
  if (!lastRound) return null;
  if (lastRound.number >= MAX_ROUNDS && lastRound.publishedAt) return null;
  return lastRound;
}

/**
 * «Drop»: ein Spieler verlässt den Abend.
 *
 * - Runde 1 im Warteraum: er hat noch nicht gespielt und fliegt aus der
 *   Runde, die dabei neu gemischt wird.
 * - Runde 1 live: er spielt sie zu Ende und wird in Runde 2 nicht
 *   eingeteilt (`droppedAt` an seiner Zuordnung in Runde 1).
 * - Runde 2 im Warteraum: wie eben, und Runde 2 wird ohne ihn neu
 *   gemischt. Ein Nachzügler wird dabei einfach wieder gestrichen.
 */
export async function dropPlayer(eveningId: string, playerId: string) {
  await requireAdmin();
  const lastRound = await loadAttendanceContext(eveningId);
  if (!lastRound) return;

  if (lastRound.number === 1 && !lastRound.publishedAt) {
    const rest = lastRound.tables
      .flatMap((t) => t.assignments.map((a) => a.playerId))
      .filter((id) => id !== playerId);
    await rebuildDraftRound(lastRound, rest);
  } else {
    const playedRound = lastRound.publishedAt ? lastRound.number : lastRound.number - 1;
    await prisma.$transaction([
      prisma.tableAssignment.updateMany({
        where: {
          playerId,
          droppedAt: null,
          table: { round: { eveningId, number: playedRound } },
        },
        data: { droppedAt: new Date() },
      }),
      prisma.lateArrival.deleteMany({ where: { eveningId, playerId } }),
    ]);
    if (!lastRound.publishedAt) await rebuildDraftRound(lastRound);
  }

  revalidatePath("/admin/league");
}

/** Nimmt einen Drop zurück; eine Runde 2 im Warteraum wird neu gemischt. */
export async function undoDrop(eveningId: string, playerId: string) {
  await requireAdmin();
  const lastRound = await loadAttendanceContext(eveningId);
  if (!lastRound) return;

  await prisma.tableAssignment.updateMany({
    where: { playerId, droppedAt: { not: null }, table: { round: { eveningId } } },
    data: { droppedAt: null },
  });
  if (lastRound.number > 1 && !lastRound.publishedAt) {
    await rebuildDraftRound(lastRound);
  }

  revalidatePath("/admin/league");
}

/**
 * Nachzügler: ist Runde 1 noch im Warteraum, wird er direkt dort
 * eingeteilt (die Runde wird neu gemischt). Sonst spielt er ab Runde 2
 * mit; steht sie schon im Warteraum, wird sie mit ihm neu gemischt.
 */
export async function addLateArrival(eveningId: string, playerId: string) {
  await requireAdmin();
  const lastRound = await loadAttendanceContext(eveningId);
  if (!lastRound) return;

  // Wie beim Start des Abends: nur Liga-Teilnehmende (SPEC.md Abschnitt 6).
  const player = await prisma.player.findFirst({
    where: { id: playerId, leagueActive: true, archivedAt: null },
    select: { id: true },
  });
  if (!player) return;

  // Wer an diesem Abend schon dabei ist (oder gedroppt hat), kommt nicht
  // ein zweites Mal dazu — ein Drop wird über undoDrop zurückgenommen.
  const [seated, late] = await Promise.all([
    prisma.tableAssignment.count({
      where: { playerId, table: { round: { eveningId } } },
    }),
    prisma.lateArrival.count({ where: { eveningId, playerId } }),
  ]);
  if (seated > 0 || late > 0) return;

  if (lastRound.number === 1 && !lastRound.publishedAt) {
    const attendees = lastRound.tables.flatMap((t) =>
      t.assignments.map((a) => a.playerId),
    );
    await rebuildDraftRound(lastRound, [...attendees, playerId]);
  } else {
    await prisma.lateArrival.create({ data: { eveningId, playerId } });
    if (!lastRound.publishedAt) await rebuildDraftRound(lastRound);
  }

  revalidatePath("/admin/league");
}

/** Streicht einen Nachzügler wieder (z.B. versehentlich hinzugefügt). */
export async function removeLateArrival(eveningId: string, playerId: string) {
  await requireAdmin();
  const lastRound = await loadAttendanceContext(eveningId);
  if (!lastRound) return;

  await prisma.lateArrival.deleteMany({ where: { eveningId, playerId } });
  if (lastRound.number > 1 && !lastRound.publishedAt) {
    await rebuildDraftRound(lastRound);
  }

  revalidatePath("/admin/league");
}
