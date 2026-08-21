import { PairingError } from "./errors";

/**
 * Eine Gruppe von Spielern, die garantiert am selben Tisch landen sollen
 * (siehe Grill-Notizen zum Casual-Modus: "Freund mitgebracht, will
 * unbedingt mit ihm spielen"). Rein clientseitiger Zustand, nicht in der
 * Datenbank — überlebt nur im Browser (localStorage), keine Migration.
 */
export interface PlayerGroup {
  id: string;
  playerIds: string[];
}

/**
 * Größte erlaubte Gruppengröße. 4 ist die größte reguläre Tischgröße
 * (siehe SPEC.md Abschnitt 3) — eine Gruppe zu 5 wäre nur bei genau 5
 * Anwesenden überhaupt sinnvoll, und dann sitzen ohnehin alle zusammen,
 * ohne dass es dafür eine Gruppe braucht.
 */
export const MAX_GROUP_SIZE = 4;

/** Kleinste sinnvolle Gruppengröße — darunter ist "Gruppe" bedeutungslos. */
export const MIN_GROUP_SIZE = 2;

export interface GroupPackingResult {
  /**
   * Parallel zu den übergebenen tableSizes: für jeden Tisch die IDs der
   * Gruppen, die ihm zugeteilt wurden (0, 1 oder mehrere — mehrere Gruppen
   * dürfen sich einen Tisch teilen, wenn sie exakt hineinpassen).
   */
  tableGroups: string[][];
}

/**
 * Prüft per Backtracking, ob sich die Gruppen ohne Aufteilung in die
 * gegebenen Tischgrößen packen lassen, und liefert im Erfolgsfall die
 * Zuteilung Gruppe → Tisch zurück (null bei Unmöglichkeit).
 *
 * Die Tischgrößen-Verteilung selbst (SPEC.md Abschnitt 3) ist dabei fix
 * und wird nie verändert — die Gruppen müssen sich in sie einfügen, nicht
 * umgekehrt. Größte Gruppen zuerst probieren, jeweils den Tisch mit der
 * meisten freien Kapazität zuerst — in der Praxis (wenige, kleine
 * Gruppen) findet das sofort eine Lösung oder stellt schnell fest, dass
 * keine existiert.
 */
export function packGroupsIntoTables(
  groupSizes: readonly { id: string; size: number }[],
  tableSizes: readonly number[],
): GroupPackingResult | null {
  const remaining = [...tableSizes];
  const tableGroups: string[][] = tableSizes.map(() => []);
  const sortedGroups = [...groupSizes].sort((a, b) => b.size - a.size);

  function backtrack(index: number): boolean {
    if (index === sortedGroups.length) return true;
    const group = sortedGroups[index];
    const candidateTables = remaining
      .map((_, i) => i)
      .filter((i) => remaining[i] >= group.size)
      .sort((a, b) => remaining[b] - remaining[a]);

    for (const t of candidateTables) {
      remaining[t] -= group.size;
      tableGroups[t].push(group.id);
      if (backtrack(index + 1)) return true;
      remaining[t] += group.size;
      tableGroups[t].pop();
    }
    return false;
  }

  if (sortedGroups.some((g) => g.size <= 0)) {
    throw new PairingError("Ungültige Gruppengröße");
  }
  if (!backtrack(0)) return null;
  return { tableGroups };
}

/** "3er-Tische" / "3er- und 4er-Tische" / "3er-, 4er- und 5er-Tische". */
function formatTableSizesList(sizes: readonly number[]): string {
  const unique = [...new Set(sizes)].sort((a, b) => a - b);
  const parts = unique.map((s) => `${s}er`);
  if (parts.length === 1) return `${parts[0]}-Tische`;
  return `${parts.slice(0, -1).join("-, ")}- und ${parts[parts.length - 1]}-Tische`;
}

export interface GroupConflict {
  message: string;
}

/**
 * Erklärt in einem kurzen, konkreten Satz, warum sich die Gruppen nicht
 * unterbringen lassen — oder gibt null zurück, wenn es passt. Gedacht für
 * die sofortige Anzeige im UI, bevor überhaupt gerechnet wird (siehe
 * Grill-Notizen: "Tische berechnen" bleibt gesperrt, bis der Konflikt
 * aufgelöst ist).
 */
export function describeGroupConflict(
  groups: readonly { id: string; label: string; playerIds: string[] }[],
  tableSizes: readonly number[],
): GroupConflict | null {
  if (groups.length === 0) return null;
  const groupSizes = groups.map((g) => ({ id: g.id, size: g.playerIds.length }));
  if (packGroupsIntoTables(groupSizes, tableSizes)) return null;

  const maxTable = Math.max(...tableSizes);
  const tooLarge = groups.filter((g) => g.playerIds.length > maxTable);
  const sizesText = formatTableSizesList(tableSizes);

  if (tooLarge.length > 0) {
    const names = tooLarge
      .map((g) => `Gruppe ${g.label} mit ${g.playerIds.length} Spielern`)
      .join(", ");
    return {
      message: `Mit dieser Anzahl gibt es nur ${sizesText} — ${names} passt nicht.`,
    };
  }

  return {
    message: `Mit dieser Anzahl (${sizesText}) lassen sich die Gruppen nicht unterbringen. Gruppe verkleinern oder weitere Spieler dazuholen.`,
  };
}

/** Mittelwert der Skill-Level einer Gruppe, für den elo-balancierten Modus. */
export function averageValue(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
