import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WINNER_KEY } from "@/lib/entrySheet";

// «Winner winner» und das Tisch-Ergebnis sind dasselbe (SPEC.md Abschnitt
// 12.2): wer zuerst einträgt, gilt. Setzt der Organisator den Sieger (🏆),
// bekommt der Sieger das Achievement automatisch; hakt ein Spieler es ab,
// solange sein Tisch noch kein Ergebnis hat, wird er dessen Sieger.
// Danach entscheidet allein der Organisator — ein neuer Sieger zieht die
// Häkchen mit.

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Gleicht die «Winner winner»-Häkchen eines Tisches an sein Ergebnis an:
 * der Sieger hat es, alle anderen am Tisch nicht. Für den Sieger wird die
 * Erfassung angelegt, falls er sich noch nicht angemeldet hat — sie wartet
 * dann auf ihn.
 */
export async function syncWinnerMarks(db: Db, tableId: string) {
  const table = await db.table.findUniqueOrThrow({
    where: { id: tableId },
    include: {
      round: { select: { number: true, eveningId: true } },
      assignments: { select: { playerId: true, isWinner: true } },
    },
  });
  const achievement = await db.eveningAchievement.findFirst({
    where: { eveningId: table.round.eveningId, systemKey: WINNER_KEY },
    select: { id: true },
  });
  // Abende ohne «Winner winner» (z.B. vor dessen Kennung angelegt).
  if (!achievement) return;

  const game = table.round.number;
  const eveningId = table.round.eveningId;
  const winner = table.assignments.find((a) => a.isWinner)?.playerId ?? null;
  const others = table.assignments.map((a) => a.playerId).filter((id) => id !== winner);

  await db.achievementMark.deleteMany({
    where: {
      eveningAchievementId: achievement.id,
      game,
      entry: { eveningId, playerId: { in: others } },
    },
  });
  if (!winner) return;

  const entry = await db.playerEntry.upsert({
    where: { eveningId_playerId: { eveningId, playerId: winner } },
    create: { eveningId, playerId: winner },
    update: {},
    select: { id: true },
  });
  await db.achievementMark.upsert({
    where: {
      entryId_eveningAchievementId_game: {
        entryId: entry.id,
        eveningAchievementId: achievement.id,
        game,
      },
    },
    create: { entryId: entry.id, eveningAchievementId: achievement.id, game, count: 1 },
    update: { count: 1 },
  });
}

/**
 * Der Tisch eines Spielers in einem Match, sofern der Spieler dort das
 * Ergebnis noch selbst eintragen darf: das Match ist live, es ist das
 * neueste des Abends und der Abend läuft — wie beim Sieger-Eintrag des
 * Organisators.
 */
async function playerTable(eveningId: string, playerId: string, game: number) {
  const assignment = await prisma.tableAssignment.findFirst({
    where: {
      playerId,
      table: { round: { eveningId, number: game, publishedAt: { not: null } } },
    },
    include: {
      table: {
        include: {
          assignments: { select: { id: true, playerId: true, isWinner: true } },
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
      },
    },
  });
  if (!assignment) return null;
  const { table } = assignment;
  const open =
    !table.round.evening.finishedAt && table.round.evening.rounds[0]?.id === table.roundId;
  return { assignment, table, open };
}

/**
 * Ein Spieler hakt «Winner winner» ab oder wieder aus. Abhaken geht nur,
 * solange sein Tisch kein Ergebnis hat — dann wird er dessen Sieger.
 * Aushaken geht nur für den eingetragenen Sieger und macht den Tisch
 * wieder offen. Gibt false zurück, wenn es nicht (mehr) geht.
 */
export async function setWinnerByPlayer(
  entry: { eveningId: string; playerId: string },
  game: number,
  won: boolean,
): Promise<boolean> {
  const found = await playerTable(entry.eveningId, entry.playerId, game);
  if (!found?.open) return false;
  const { assignment, table } = found;

  if (won) {
    if (table.resultEnteredAt && !assignment.isWinner) return false;
    if (assignment.isWinner) return true;
    // Bedingt auf «noch kein Ergebnis»: haken zwei Spieler am selben Tisch
    // gleichzeitig ab, gewinnt genau einer.
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.table.updateMany({
        where: { id: table.id, resultEnteredAt: null },
        data: { resultEnteredAt: new Date() },
      });
      if (count !== 1) return false;
      await tx.tableAssignment.update({
        where: { id: assignment.id },
        data: { isWinner: true },
      });
      await syncWinnerMarks(tx, table.id);
      return true;
    });
  }

  if (!assignment.isWinner) return true;
  await prisma.$transaction(async (tx) => {
    await tx.tableAssignment.updateMany({ where: { tableId: table.id }, data: { isWinner: false } });
    await tx.table.update({ where: { id: table.id }, data: { resultEnteredAt: null } });
    await syncWinnerMarks(tx, table.id);
  });
  return true;
}

/**
 * Warum «Winner winner» auf dem Blatt eines Spielers gesperrt ist, je
 * Match — null, wenn er es selbst setzen darf. `names` liefert die
 * öffentlichen Namen.
 */
export async function winnerNotes(
  eveningId: string,
  playerId: string,
  games: number[],
  names: Map<string, string>,
): Promise<Record<number, string | null>> {
  const notes: Record<number, string | null> = {};
  for (const game of games) {
    const found = await playerTable(eveningId, playerId, game);
    if (!found) {
      notes[game] = null;
      continue;
    }
    const { assignment, table, open } = found;
    const winner = table.assignments.find((a) => a.isWinner);
    if (table.resultEnteredAt && !winner) notes[game] = "Unentschieden";
    else if (winner && winner.id !== assignment.id) {
      notes[game] = `Sieger: ${names.get(winner.playerId) ?? "jemand anderes"}`;
    } else if (!open) notes[game] = "vom Tisch-Ergebnis übernommen";
    else notes[game] = null;
  }
  return notes;
}
