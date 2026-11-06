import { computeTableSizes } from "./tableSizes";

/**
 * Fügt einen Spieler in bestehende Tische ein, ohne neu zu mischen (SPEC.md
 * Abschnitt 5.3): für ein Match, das schon live war und zurück in den
 * Warteraum genommen wurde — die Spieler sitzen dann schon.
 *
 * Ziel ist die übliche Tischverteilung für die neue Spielerzahl
 * (`computeTableSizes`). Hat ein Tisch Platz, kommt der Spieler dorthin
 * (an den kleinsten). Sonst entsteht ein neuer Tisch, für den so wenige
 * Spieler wie nötig von den grössten Tischen herüberwechseln — zufällig
 * gewählt. Alle anderen bleiben sitzen.
 *
 * Gibt die Tische in der bisherigen Reihenfolge zurück, einen neuen Tisch
 * zuletzt. null, wenn es ohne Umbau nicht geht — dann mischt der Aufrufer
 * neu.
 */
export function insertIntoTables(
  tables: readonly (readonly string[])[],
  playerId: string,
  random: () => number = Math.random,
): string[][] | null {
  const total = tables.reduce((n, t) => n + t.length, 0) + 1;
  const targets = computeTableSizes(total); // absteigend
  if (targets.length < tables.length || targets.length > tables.length + 1) return null;

  const result = tables.map((t) => [...t]);
  // Grösste Tische bekommen die grössten Zielgrössen — so wechseln am
  // wenigsten Spieler. Bei Gleichstand der vordere Tisch zuerst.
  const order = result
    .map((t, i) => ({ i, size: t.length }))
    .sort((a, b) => b.size - a.size || a.i - b.i)
    .map((x) => x.i);
  const target = new Map(order.map((i, k) => [i, targets[k]]));
  if (targets.length > tables.length) {
    result.push([]);
    target.set(result.length - 1, targets[targets.length - 1]);
  }

  // Wer seinen Tisch verlassen muss: zufällig aus den zu grossen Tischen.
  const pool = [playerId];
  for (const [i, size] of target) {
    const table = result[i];
    while (table.length > size) {
      const k = Math.floor(random() * table.length);
      pool.push(...table.splice(k, 1));
    }
  }
  // Der neue Spieler zuerst an den kleinsten Tisch mit Platz, die
  // Gewechselten auf die übrigen freien Plätze.
  const open = [...target.keys()]
    .filter((i) => result[i].length < target.get(i)!)
    .sort((a, b) => result[a].length - result[b].length || a - b);
  for (const i of open) {
    while (result[i].length < target.get(i)! && pool.length > 0) {
      result[i].push(pool.shift()!);
    }
  }
  if (pool.length > 0 || result.some((t, i) => t.length !== target.get(i))) return null;
  return result;
}
