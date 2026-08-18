import { prisma } from "@/lib/prisma";
import { pairKey, tablePairKeys } from "./leagueAssignment";

/**
 * Baut die Menge aller Spielerpaare, die an diesem Abend bereits in einer
 * früheren Runde am selben Tisch saßen (für die Rematch-Vermeidung,
 * siehe SPEC.md Abschnitt 5.2).
 */
export async function buildPreviousPairings(
  eveningId: string,
): Promise<Set<string>> {
  const rounds = await prisma.round.findMany({
    where: { eveningId },
    include: { tables: { include: { assignments: true } } },
  });

  const pairings = new Set<string>();
  for (const round of rounds) {
    for (const table of round.tables) {
      const playerIds = table.assignments.map((a) => a.playerId);
      for (const key of tablePairKeys(playerIds)) {
        pairings.add(key);
      }
    }
  }
  return pairings;
}

export { pairKey };
