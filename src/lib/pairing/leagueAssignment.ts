import { shuffle } from "./shuffle";
import { computeTableSizes } from "./tableSizes";

export interface RankedPlayer {
  id: string;
  points: number;
}

/** Eindeutiger, ordnungsunabhängiger Schlüssel für ein Spielerpaar. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Baut alle Paar-Schlüssel innerhalb eines Tisches (jeder mit jedem). */
function tablePairKeys(table: string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      keys.push(pairKey(table[i], table[j]));
    }
  }
  return keys;
}

function countRematches(table: string[], previousPairings: ReadonlySet<string>): number {
  let count = 0;
  for (const key of tablePairKeys(table)) {
    if (previousPairings.has(key)) count++;
  }
  return count;
}

/**
 * Um wie viele Ränge sich die Trennlinie zwischen oberer und unterer
 * Hälfte bei jeder Ziehung zufällig verschiebt (siehe `assignLeagueRound`).
 *
 * Ohne diese Unschärfe (0) wäre die Grenze eine harte Kante: zwei fast
 * gleich starke Spieler direkt an der Mitte (z.B. Rang 14 und 15 bei 28
 * Anwesenden) würden sich NIE begegnen, während zwei Spieler eine Position
 * weiter innen (Rang 13/14) sich wie jedes andere Paar ihrer Hälfte
 * begegnen. Eine Simulation zeigt: mit ±1 Rang Unschärfe treffen sich
 * Rang 14 und 15 in ~13% der Ziehungen (statt 0%), während die Sicherheit
 * an den Extremen erhalten bleibt — Rang 1 trifft in 100'000 simulierten
 * Ziehungen kein einziges Mal auf die untersten Ränge (siehe BACKLOG.md).
 */
export const GRENZ_UNSCHAERFE = 1;

/** Tische brauchen mindestens 3 Spieler — siehe `computeTableSizes`. */
const MIN_HAELFTE = 3;

/** Verteilt eine Gruppe komplett zufällig auf Tische der übergebenen Größen. */
function assignRandomly(ids: readonly string[], tableSizes: readonly number[]): string[][] {
  const shuffled = shuffle(ids);
  const orderedSizes = [...tableSizes].sort((a, b) => b - a);
  const tables: string[][] = [];
  let cursor = 0;
  for (const size of orderedSizes) {
    tables.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return tables;
}

/**
 * Teilt die (bereits nach Punkten sortierten) Spieler in eine obere und
 * eine untere Hälfte, mit einer kleinen zufälligen Verschiebung der
 * Trennlinie um bis zu `unschaerfe` Ränge (siehe `GRENZ_UNSCHAERFE`).
 *
 * Die Grenze bleibt dabei immer mindestens `MIN_HAELFTE` von beiden
 * Rändern entfernt, damit keine der beiden Hälften zu klein für eine
 * gültige Tischgrößen-Verteilung wird.
 */
function splitInHalves(
  sortedPlayers: readonly RankedPlayer[],
  unschaerfe: number,
): [RankedPlayer[], RankedPlayer[]] {
  const n = sortedPlayers.length;
  const mitte = Math.ceil(n / 2);
  const offset =
    unschaerfe === 0 ? 0 : Math.floor(Math.random() * (2 * unschaerfe + 1)) - unschaerfe;
  const grenze = Math.min(n - MIN_HAELFTE, Math.max(MIN_HAELFTE, mitte + offset));
  return [sortedPlayers.slice(0, grenze), sortedPlayers.slice(grenze)];
}

/**
 * Weist Spieler den Tischen einer Modus-B-Runde zu.
 *
 * Vorgehen (siehe SPEC.md Abschnitt 5.1 und 5.2, sowie BACKLOG.md für die
 * Herleitung):
 * 1. Spieler nach Punkten absteigend sortieren.
 * 2. In eine obere und eine untere Hälfte teilen (mit leicht verschobener
 *    Trennlinie, siehe `GRENZ_UNSCHAERFE`) — die stärkere Hälfte spielt
 *    nie gegen die schwächere.
 * 3. Innerhalb jeder Hälfte komplett zufällig auf die Tische verteilen —
 *    kein Rang-Bezug mehr. Das verhindert, dass sich dieselbe kleine
 *    Gruppe (z.B. die besten 4-5) immer wieder an einem Tisch häuft, ein
 *    Effekt, den reines Zufalls-Rauschen auf einer durchgehenden
 *    Rangliste nicht auflösen konnte (siehe BACKLOG.md).
 * 4. Lokale Verbesserung: zwei Spieler *derselben Hälfte* dürfen
 *    getauscht werden, wenn das eine Wiederholungsbegegnung (Rematch) aus
 *    einer vorherigen Runde desselben Abends auflöst — nie über die
 *    Hälften-Grenze hinweg.
 *
 * Bei sehr kleinen Abenden (unter 6 Anwesenden) liesse sich keine der
 * beiden Hälften mehr gültig auf Tische verteilen (mindestens 3 Spieler
 * pro Tisch) — dann bleibt das gesamte Feld eine einzige Gruppe.
 *
 * @param players Anwesende Spieler mit ihrem aktuellen Sortier-Wert
 *   (siehe `rankValues` in leagueRanking.ts).
 * @param previousPairings Set von pairKey(a,b) für Spieler, die an diesem
 *   Abend in einer früheren Runde bereits am selben Tisch saßen.
 * @param grenzUnschaerfe Override für `GRENZ_UNSCHAERFE` (v.a. für Tests
 *   nützlich, um die Verschiebung gezielt an- oder auszuschalten).
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignLeagueRound(
  players: readonly RankedPlayer[],
  previousPairings: ReadonlySet<string> = new Set(),
  grenzUnschaerfe: number = GRENZ_UNSCHAERFE,
): string[][] {
  const sortiert = [...players].sort((a, b) => b.points - a.points);

  if (sortiert.length < MIN_HAELFTE * 2) {
    const tables = assignRandomly(
      sortiert.map((p) => p.id),
      computeTableSizes(sortiert.length),
    );
    if (previousPairings.size > 0) improveRematches(tables, previousPairings);
    return tables;
  }

  const [oben, unten] = splitInHalves(sortiert, grenzUnschaerfe);
  const obenTables = assignRandomly(
    oben.map((p) => p.id),
    computeTableSizes(oben.length),
  );
  const untenTables = assignRandomly(
    unten.map((p) => p.id),
    computeTableSizes(unten.length),
  );

  if (previousPairings.size > 0) {
    // Getrennt pro Hälfte aufgerufen, damit ein Tausch nie über die
    // Hälften-Grenze hinweg stattfindet.
    improveRematches(obenTables, previousPairings);
    improveRematches(untenTables, previousPairings);
  }

  return [...obenTables, ...untenTables];
}

/**
 * Tauscht Spieler zwischen zwei Tischen (innerhalb der übergebenen Liste),
 * wenn das eine Rematch-Begegnung aus `previousPairings` auflöst, ohne
 * eine neue zu erzeugen. Anders als früher gibt es keine Bedingung mehr
 * an die Sortierwerte der Tauschenden — innerhalb einer Hälfte sind
 * ohnehin alle Spieler gleichwertig austauschbar (siehe `assignLeagueRound`).
 */
function improveRematches(tables: string[][], previousPairings: ReadonlySet<string>): void {
  const MAX_PASSES = 20;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let i = 0; i < tables.length && !improved; i++) {
      for (let j = i + 1; j < tables.length && !improved; j++) {
        const tableA = tables[i];
        const tableB = tables[j];

        for (let ai = 0; ai < tableA.length && !improved; ai++) {
          for (let bi = 0; bi < tableB.length && !improved; bi++) {
            const playerA = tableA[ai];
            const playerB = tableB[bi];

            const before =
              countRematches(tableA, previousPairings) +
              countRematches(tableB, previousPairings);

            tableA[ai] = playerB;
            tableB[bi] = playerA;

            const after =
              countRematches(tableA, previousPairings) +
              countRematches(tableB, previousPairings);

            if (after < before) {
              improved = true; // Tausch behalten, nächste Passe starten.
            } else {
              // Tausch rückgängig machen.
              tableA[ai] = playerA;
              tableB[bi] = playerB;
            }
          }
        }
      }
    }

    if (!improved) break;
  }
}

export { pairKey, tablePairKeys, countRematches };
