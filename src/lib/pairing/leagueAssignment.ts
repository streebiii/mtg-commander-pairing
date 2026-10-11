import { shuffle } from "./shuffle";
import { computeTableSizes, dealIntoTables } from "./tableSizes";

/**
 * Zwei Runden pro Liga-Abend — so steht es in den Liga-Regeln auf
 * mtgbl.ch ("Pro Liga-Abend werden zwei Spiele gespielt").
 */
export const MAX_ROUNDS = 2;

export interface RankedPlayer {
  id: string;
  points: number;
}

/** Eindeutiger, ordnungsunabhängiger Schlüssel für ein Spielerpaar. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Baut alle Paar-Schlüssel innerhalb eines Tisches (jeder mit jedem). */
function tablePairKeys(table: readonly string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      keys.push(pairKey(table[i], table[j]));
    }
  }
  return keys;
}

function countRematches(table: readonly string[], previousPairings: ReadonlySet<string>): number {
  let count = 0;
  for (const key of tablePairKeys(table)) {
    if (previousPairings.has(key)) count++;
  }
  return count;
}

/** Tische brauchen mindestens 3 Spieler — siehe `computeTableSizes`. */
const MIN_HAELFTE = 3;

/** Verteilt Spieler komplett zufällig auf so viele Tische wie nötig. */
function assignRandomly(ids: readonly string[]): string[][] {
  return dealIntoTables(shuffle(ids), computeTableSizes(ids.length));
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
 * Lässt sich ein Nicht-4er-Tisch nicht ganz vermeiden, landet er
 * bevorzugt in der unteren (schwächeren) Hälfte: unter den Aufteilungen
 * mit derselben Gesamtzahl an Nicht-4er-Tischen gewinnt die mit den
 * wenigsten davon in der oberen Hälfte. Für jede Aufteilung mit einem
 * Nicht-4er-Tisch oben existiert rein rechnerisch immer die gespiegelte
 * Aufteilung mit demselben Tisch stattdessen unten — diese Regel wählt
 * also, wo es eine Wahl gibt, konsequent die spiegelbildliche Variante.
 *
 * Erst danach wird unter den verbleibenden, gleichwertigen Aufteilungen
 * die gewählt, die am nächsten an der exakten Mitte liegt (möglichst
 * ausgeglichene Hälften). Gibt es mehrere gleichwertige Aufteilungen,
 * wird zufällig eine davon gewählt — das liefert dieselbe Abwechslung an
 * der Grenze, die zuvor eine feste Unschärfe künstlich erzeugen musste,
 * jetzt aber nie auf Kosten der Tischgrössen oder der Spitze.
 */
function waehleHaelftenGrenze(n: number): number {
  const kandidaten: {
    grenze: number;
    nichtViererGesamt: number;
    nichtViererOben: number;
    distanz: number;
  }[] = [];
  for (let grenze = MIN_HAELFTE; grenze <= n - MIN_HAELFTE; grenze++) {
    const obenSizes = computeTableSizes(grenze);
    const untenSizes = computeTableSizes(n - grenze);
    kandidaten.push({
      grenze,
      nichtViererGesamt: nichtVierer(obenSizes) + nichtVierer(untenSizes),
      nichtViererOben: nichtVierer(obenSizes),
      distanz: Math.abs(grenze - n / 2),
    });
  }

  const minGesamt = Math.min(...kandidaten.map((k) => k.nichtViererGesamt));
  const beiMinGesamt = kandidaten.filter((k) => k.nichtViererGesamt === minGesamt);

  const minOben = Math.min(...beiMinGesamt.map((k) => k.nichtViererOben));
  const beiMinOben = beiMinGesamt.filter((k) => k.nichtViererOben === minOben);

  const minDistanz = Math.min(...beiMinOben.map((k) => k.distanz));
  const beste = beiMinOben.filter((k) => k.distanz === minDistanz);

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
 * Gewichte für die lokale Verbesserung (siehe `bewerteTisch`) — höher
 * heisst wichtiger. Rematches wiegen am schwersten (die ursprüngliche,
 * am längsten bewährte Vermeidung), die wiederholte 3er-Zuteilung mehr
 * als der Sieger-Zusammensitz-Bonus, der als reine Kür gedacht ist.
 */
const GEWICHT_REMATCH = 3;
const GEWICHT_WIEDERHOLTER_NICHT_VIERER = 2;
const GEWICHT_SIEGER_ZUSAMMEN = 1;

/**
 * "Kosten" eines Tisches für die lokale Verbesserung — je niedriger,
 * desto besser. Rematches und wiederholte Nicht-4er-Zuteilungen erhöhen
 * die Kosten, ein Sieger-Paar am selben Tisch senkt sie (siehe
 * `verbessereZuteilung`).
 */
function bewerteTisch(
  table: readonly string[],
  previousPairings: ReadonlySet<string>,
  wiederholteNichtVierer: ReadonlySet<string>,
  sieger: ReadonlySet<string>,
): number {
  let kosten = GEWICHT_REMATCH * countRematches(table, previousPairings);

  if (table.length !== 4) {
    kosten +=
      GEWICHT_WIEDERHOLTER_NICHT_VIERER *
      table.filter((id) => wiederholteNichtVierer.has(id)).length;
  }

  let siegerPaare = 0;
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      if (sieger.has(table[i]) && sieger.has(table[j])) siegerPaare++;
    }
  }
  kosten -= GEWICHT_SIEGER_ZUSAMMEN * siegerPaare;

  return kosten;
}

/**
 * Weist Spieler den Tischen einer Liga-Runde zu.
 *
 * Vorgehen (siehe SPEC.md Abschnitt 5.1 und 5.2, sowie BACKLOG.md für die
 * Herleitung):
 * 1. Spieler nach Punkten absteigend sortieren.
 * 2. In eine obere und eine untere Hälfte teilen (siehe
 *    `waehleHaelftenGrenze`) — die stärkere Hälfte spielt nie gegen die
 *    schwächere. Die Trennlinie liegt nicht stur bei der exakten Mitte,
 *    sondern dort, wo insgesamt die wenigsten Nicht-4er-Tische entstehen
 *    (und, wo eine Wahl bleibt, in der unteren Hälfte statt der oberen).
 * 3. Innerhalb jeder Hälfte komplett zufällig auf die Tische verteilen —
 *    kein Rang-Bezug mehr. Das verhindert, dass sich dieselbe kleine
 *    Gruppe (z.B. die besten 4-5) immer wieder an einem Tisch häuft, ein
 *    Effekt, den reines Zufalls-Rauschen auf einer durchgehenden
 *    Rangliste nicht auflösen konnte (siehe BACKLOG.md).
 * 4. Lokale Verbesserung (siehe `verbessereZuteilung`): zwei Spieler
 *    *derselben Hälfte* dürfen getauscht werden, wenn das insgesamt die
 *    Kosten senkt — weniger Rematches, seltener zweimal an einem
 *    Nicht-4er-Tisch, mehr Sieger-Paare am selben Tisch. Nie über die
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
 * @param wiederholteNichtVierer Set von Spieler-IDs, die an diesem Abend
 *   bereits an einem Nicht-4er-Tisch (i.d.R. ein 3er) sassen — siehe
 *   `buildPreviousNonFourTablePlayers` in leagueHistory.ts.
 * @param sieger IDs der Spieler, die ihre letzte Runde gewonnen haben —
 *   dieselbe Menge, die auch `rankValues` für den Sieg-Bonus bekommt.
 *   Erhöht die Chance, dass zwei Sieger an einem Tisch landen.
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignLeagueRound(
  players: readonly RankedPlayer[],
  previousPairings: ReadonlySet<string> = new Set(),
  wiederholteNichtVierer: ReadonlySet<string> = new Set(),
  sieger: ReadonlySet<string> = new Set(),
): string[][] {
  const sortiert = [...players].sort((a, b) => b.points - a.points);
  const hatVerbesserungspotential =
    previousPairings.size > 0 || wiederholteNichtVierer.size > 0 || sieger.size > 0;

  if (sortiert.length < MIN_HAELFTE * 2) {
    const tables = assignRandomly(sortiert.map((p) => p.id));
    if (hatVerbesserungspotential) {
      verbessereZuteilung(tables, previousPairings, wiederholteNichtVierer, sieger);
    }
    return tables;
  }

  const [oben, unten] = splitInHalves(sortiert);
  const obenTables = assignRandomly(oben.map((p) => p.id));
  const untenTables = assignRandomly(unten.map((p) => p.id));

  if (hatVerbesserungspotential) {
    // Getrennt pro Hälfte aufgerufen, damit ein Tausch nie über die
    // Hälften-Grenze hinweg stattfindet.
    verbessereZuteilung(obenTables, previousPairings, wiederholteNichtVierer, sieger);
    verbessereZuteilung(untenTables, previousPairings, wiederholteNichtVierer, sieger);
  }

  return [...obenTables, ...untenTables];
}

/**
 * Tauscht Spieler zwischen zwei Tischen (innerhalb der übergebenen Liste),
 * wenn das insgesamt die Kosten senkt (siehe `bewerteTisch`) — weniger
 * Rematches, seltener eine wiederholte Nicht-4er-Zuteilung, mehr
 * Sieger-Paare am selben Tisch. Es gibt keine Bedingung an die Sortier-
 * werte der Tauschenden — innerhalb einer Hälfte sind ohnehin alle
 * Spieler gleichwertig austauschbar (siehe `assignLeagueRound`).
 */
function verbessereZuteilung(
  tables: string[][],
  previousPairings: ReadonlySet<string>,
  wiederholteNichtVierer: ReadonlySet<string>,
  sieger: ReadonlySet<string>,
): void {
  const MAX_PASSES = 20;
  const kosten = (table: readonly string[]) =>
    bewerteTisch(table, previousPairings, wiederholteNichtVierer, sieger);

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

            const before = kosten(tableA) + kosten(tableB);

            tableA[ai] = playerB;
            tableB[bi] = playerA;

            const after = kosten(tableA) + kosten(tableB);

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
