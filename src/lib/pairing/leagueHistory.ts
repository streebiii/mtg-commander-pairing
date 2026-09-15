import { prisma } from "@/lib/prisma";
import { pairKey, tablePairKeys } from "./leagueAssignment";

/**
 * Baut die Menge aller Spielerpaare, die an diesem Abend bereits in einer
 * früheren Runde am selben Tisch saßen (für die Rematch-Vermeidung,
 * siehe SPEC.md Abschnitt 5.2).
 *
 * @param beforeRoundNumber Wenn gesetzt, werden nur Runden mit einer
 *   kleineren Rundennummer berücksichtigt — nützlich beim Neu-Auswürfeln
 *   einer Runde, deren eigene (noch zu ersetzende) Paarungen nicht als
 *   "bereits gespielt" zählen sollen.
 */
export async function buildPreviousPairings(
  eveningId: string,
  beforeRoundNumber?: number,
): Promise<Set<string>> {
  const rounds = await prisma.round.findMany({
    where: {
      eveningId,
      ...(beforeRoundNumber !== undefined
        ? { number: { lt: beforeRoundNumber } }
        : {}),
    },
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

/**
 * Baut die Menge aller Spieler, die an diesem Abend bereits an einem
 * Nicht-4er-Tisch (i.d.R. ein 3er) sassen — damit dieselbe Person nicht
 * an noch einem kleineren Tisch landet, wenn es sich vermeiden lässt
 * (siehe `assignLeagueRound` in leagueAssignment.ts).
 *
 * @param beforeRoundNumber Wenn gesetzt, werden nur Runden mit einer
 *   kleineren Rundennummer berücksichtigt — nützlich beim Neu-Auswürfeln
 *   einer Runde, deren eigene (noch zu ersetzende) Zuteilung nicht als
 *   "schon dabei gewesen" zählen soll.
 */
export async function buildPreviousNonFourTablePlayers(
  eveningId: string,
  beforeRoundNumber?: number,
): Promise<Set<string>> {
  const rounds = await prisma.round.findMany({
    where: {
      eveningId,
      ...(beforeRoundNumber !== undefined
        ? { number: { lt: beforeRoundNumber } }
        : {}),
    },
    include: { tables: { include: { assignments: true } } },
  });

  const players = new Set<string>();
  for (const round of rounds) {
    for (const table of round.tables) {
      if (table.size === 4) continue;
      for (const assignment of table.assignments) {
        players.add(assignment.playerId);
      }
    }
  }
  return players;
}

export { pairKey };
