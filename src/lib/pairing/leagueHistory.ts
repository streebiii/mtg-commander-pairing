import { prisma } from "@/lib/prisma";
import { tablePairKeys } from "./leagueAssignment";

export interface EveningHistory {
  /**
   * Alle Spielerpaare, die an diesem Abend bereits am selben Tisch sassen
   * (für die Rematch-Vermeidung, siehe SPEC.md Abschnitt 5.2).
   */
  previousPairings: Set<string>;
  /**
   * Alle Spieler, die an diesem Abend bereits an einem Nicht-4er-Tisch
   * (i.d.R. ein 3er) sassen — damit dieselbe Person nicht an noch einem
   * kleineren Tisch landet, wenn es sich vermeiden lässt.
   */
  wiederholteNichtVierer: Set<string>;
}

/**
 * Liest, was an einem Abend schon gespielt wurde — die Grundlage für den
 * Tausch-Optimierer in `assignLeagueRound`.
 *
 * @param beforeRoundNumber Wenn gesetzt, zählen nur Runden mit einer
 *   kleineren Nummer — beim Neu-Auswürfeln einer Runde sollen deren
 *   eigene (noch zu ersetzende) Tische nicht als "schon gespielt" zählen.
 */
export async function loadEveningHistory(
  eveningId: string,
  beforeRoundNumber?: number,
): Promise<EveningHistory> {
  const tables = await prisma.table.findMany({
    where: {
      round: {
        eveningId,
        ...(beforeRoundNumber !== undefined
          ? { number: { lt: beforeRoundNumber } }
          : {}),
      },
    },
    select: { size: true, assignments: { select: { playerId: true } } },
  });

  const previousPairings = new Set<string>();
  const wiederholteNichtVierer = new Set<string>();
  for (const table of tables) {
    const playerIds = table.assignments.map((a) => a.playerId);
    for (const key of tablePairKeys(playerIds)) previousPairings.add(key);
    if (table.size !== 4) {
      for (const id of playerIds) wiederholteNichtVierer.add(id);
    }
  }
  return { previousPairings, wiederholteNichtVierer };
}
