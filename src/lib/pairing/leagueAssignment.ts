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

/** Wie viele Tische einer Grösse ungleich 4 eine Tischgrössen-Liste enthält. */
function nichtVierer(sizes: readonly number[]): number {
  return sizes.filter((size) => size !== 4).length;
}

/**
 * Bestimmt, wie viele Spieler die obere Hälfte bekommt.
 *
 * Bevorzugt wird — vor allem anderen — die Aufteilung, die *insgesamt*
 * (über beide Hälften) die wenigsten Nicht-4er-Tische ergibt: geht die
 * Gesamtzahl der Anwesenden rein rechnerisch komplett in 4er-Tische auf
 * (z.B. 28 Spieler → 7×4), darf die Halbierung selbst keine unnötigen
 * 3er-Tische erzeugen — eine exakte Hälfte von 14/14 ergäbe sonst pro
 * Seite `[4,4,3,3]" statt der mit 12/16 möglichen reinen 4er-Aufteilung.
 *
 * Erst unter den so gefundenen, tischgrössen-optimalen Aufteilungen wird
 * die gewählt, die am nächsten an der exakten Mitte liegt (möglichst
 * ausgeglichene Hälften). Gibt es mehrere gleichwertige Aufteilungen,
 * wird zufällig eine davon gewählt — das liefert dieselbe Abwechslung an
 * der Grenze, die zuvor eine feste Unschärfe künstlich erzeugen musste,
 * jetzt aber nie auf Kosten der Tischgrössen.
 */
function waehleHaelftenGrenze(n: number): number {
  const kandidaten: { grenze: number; nichtVierer: number; distanz: number }[] = [];
  for (let grenze = MIN_HAELFTE; grenze <= n - MIN_HAELFTE; grenze++) {
    kandidaten.push({
      grenze,
      nichtVierer:
        nichtVierer(computeTableSizes(grenze)) + nichtVierer(computeTableSizes(n - grenze)),
      distanz: Math.abs(grenze - n / 2),
    });
  }

  const minNichtVierer = Math.min(...kandidaten.map((k) => k.nichtVierer));
  const beiMinNichtVierer = kandidaten.filter((k) => k.nichtVierer === minNichtVierer);
  const minDistanz = Math.min(...beiMinNichtVierer.map((k) => k.distanz));
  const beste = beiMinNichtVierer.filter((k) => k.distanz === minDistanz);

  return beste[Math.floor(Math.random() * beste.length)].grenze;
}

/**
 * Teilt die (bereits nach Punkten sortierten) Spieler in eine obere und
 * eine untere Hälfte (siehe `waehleHaelftenGrenze`).
 */
function splitInHalves(
  sortedPlayers: readonly RankedPlayer[],
): [RankedPlayer[], RankedPlayer[]] {
  const grenze = waehleHaelftenGrenze(sortedPlayers.length);
  return [sortedPlayers.slice(0, grenze), sortedPlayers.slice(grenze)];
}

/**
 * Weist Spieler den Tischen einer Modus-B-Runde zu.
 *
 * Vorgehen (siehe SPEC.md Abschnitt 5.1 und 5.2, sowie BACKLOG.md für die
 * Herleitung):
 * 1. Spieler nach Punkten absteigend sortieren.
 * 2. In eine obere und eine untere Hälfte teilen (siehe
 *    `waehleHaelftenGrenze`) — die stärkere Hälfte spielt nie gegen die
 *    schwächere. Die Trennlinie liegt nicht stur bei der exakten Mitte,
 *    sondern dort, wo insgesamt die wenigsten Nicht-4er-Tische entstehen.
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
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignLeagueRound(
  players: readonly RankedPlayer[],
  previousPairings: ReadonlySet<string> = new Set(),
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

  const [oben, unten] = splitInHalves(sortiert);
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
