import { prisma } from "@/lib/prisma";

// «Winner winner» trägt der Sieger selbst ein (SPEC.md Abschnitt 12.2,
// Entscheid des Organisators vom 06.11.2026). Der Pokal des Organisators
// setzt es nicht mehr — er bestimmt nur den Tischsieger für die Paarung.
// Umgekehrt gilt weiterhin: hakt ein Spieler es ab, solange sein Tisch
// noch offen ist, wird er dessen Sieger; das spart dem Organisator den
// Pokal.

/**
 * Der Tisch eines Spielers in einem Match, sofern dort das Ergebnis noch
 * änderbar ist: das Match ist live, es ist das neueste des Abends und der
 * Abend läuft — wie beim Sieger-Eintrag des Organisators.
 */
async function openPlayerTable(eveningId: string, playerId: string, game: number) {
  const assignment = await prisma.tableAssignment.findFirst({
    where: {
      playerId,
      table: { round: { eveningId, number: game, publishedAt: { not: null } } },
    },
    include: {
      table: {
        include: {
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
  return open ? assignment : null;
}

/**
 * Folgt dem Häkchen «Winner winner» eines Spielers am Tisch: abgehakt
 * wird er Tischsieger, falls der Tisch noch kein Ergebnis hat; ausgehakt
 * wird der Tisch wieder offen, falls er dort als Sieger steht. Steht schon
 * ein anderes Ergebnis, ändert das Häkchen nichts am Tisch — der
 * Organisator gleicht ab.
 */
export async function winnerMarkToTable(
  entry: { eveningId: string; playerId: string },
  game: number,
  won: boolean,
): Promise<void> {
  const assignment = await openPlayerTable(entry.eveningId, entry.playerId, game);
  if (!assignment) return;

  if (won) {
    // Bedingt auf «noch kein Ergebnis»: haken zwei Spieler am selben Tisch
    // gleichzeitig ab, wird genau einer Tischsieger.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.table.updateMany({
        where: { id: assignment.tableId, resultEnteredAt: null },
        data: { resultEnteredAt: new Date() },
      });
      if (count === 1) {
        await tx.tableAssignment.update({
          where: { id: assignment.id },
          data: { isWinner: true },
        });
      }
    });
    return;
  }

  if (!assignment.isWinner) return;
  await prisma.$transaction([
    prisma.tableAssignment.updateMany({
      where: { tableId: assignment.tableId },
      data: { isWinner: false },
    }),
    prisma.table.update({
      where: { id: assignment.tableId },
      data: { resultEnteredAt: null },
    }),
  ]);
}
