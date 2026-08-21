import { shuffle } from "./shuffle";
import { PairingError } from "./errors";
import { packGroupsIntoTables, type PlayerGroup } from "./groups";

/**
 * Weist Spieler zufällig den Tischen einer Modus-A-Runde (Casual) zu.
 * Keine Rangliste, keine Rematch-Vermeidung, keine Mehrrunden-Logik
 * (siehe SPEC.md Abschnitt 4).
 *
 * Optional werden Gruppen (siehe SPEC.md Abschnitt 4.1) hart
 * berücksichtigt: ihre Mitglieder landen garantiert am selben Tisch,
 * die Tischgrößen-Verteilung selbst bleibt unangetastet. Mehrere
 * Gruppen dürfen sich einen Tisch teilen, wenn sie exakt hineinpassen.
 * Ist die Kombination unmöglich, wirft diese Funktion einen
 * PairingError — das UI sollte das aber schon vorher über
 * `describeGroupConflict` verhindert haben.
 *
 * @param playerIds IDs der anwesenden Spieler.
 * @param tableSizes Tischgrößen gemäß computeTableSizes.
 * @param groups Optionale Gruppen, die zusammen sitzen sollen.
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignCasualRound(
  playerIds: readonly string[],
  tableSizes: readonly number[],
  groups: readonly PlayerGroup[] = [],
): string[][] {
  const totalSeats = tableSizes.reduce((a, b) => a + b, 0);
  if (totalSeats !== playerIds.length) {
    throw new PairingError(
      `Tischgrößen (Summe ${totalSeats}) passen nicht zur Spieleranzahl (${playerIds.length})`,
    );
  }

  if (groups.length === 0) {
    const shuffled = shuffle(playerIds);
    const orderedSizes = [...tableSizes].sort((a, b) => b - a);

    const tables: string[][] = [];
    let cursor = 0;
    for (const size of orderedSizes) {
      tables.push(shuffled.slice(cursor, cursor + size));
      cursor += size;
    }
    return tables;
  }

  const orderedSizes = [...tableSizes].sort((a, b) => b - a);
  const groupSizeEntries = groups.map((g) => ({
    id: g.id,
    size: g.playerIds.length,
  }));
  const packing = packGroupsIntoTables(groupSizeEntries, orderedSizes);
  if (!packing) {
    throw new PairingError(
      "Die Gruppen passen nicht in die berechneten Tischgrößen",
    );
  }

  const groupById = new Map(groups.map((g) => [g.id, g.playerIds]));
  const groupedPlayerIds = new Set(groups.flatMap((g) => g.playerIds));
  const singles = shuffle(
    playerIds.filter((id) => !groupedPlayerIds.has(id)),
  );

  let singleCursor = 0;
  return orderedSizes.map((size, i) => {
    const groupIds = packing.tableGroups[i];
    const seated = groupIds.flatMap((gid) => shuffle(groupById.get(gid)!));
    const fillerCount = size - seated.length;
    const fillers = singles.slice(singleCursor, singleCursor + fillerCount);
    singleCursor += fillerCount;
    return shuffle([...seated, ...fillers]);
  });
}
