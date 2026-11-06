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

/**
 * Verteilt eine Gruppe (eine Hälfte) auf so viele Tische wie nötig: die
 * Sieger der Vorrunde zuerst, zusammen an die grössten Tische (4er vor
 * 3er), danach die übrigen zufällig. So spielen die Sieger einer Hälfte
 * in Runde 2 garantiert gegeneinander (SPEC.md Abschnitt 5.2); gibt es
 * mehr Sieger, als an einen Tisch passen, füllen sie den nächsten. Ohne
 * Sieger (Runde 1) ist das eine rein zufällige Verteilung.
 */
function assignHalf(ids: readonly string[], sieger: ReadonlySet<string>): string[][] {
  // dealIntoTables füllt Tisch für Tisch, die grössten zuerst — die Sieger
  // vorne in der Reihenfolge landen also zusammen am ersten 4er-Tisch.
  const reihenfolge = [
    ...shuffle(ids.filter((id) => sieger.has(id))),
    ...shuffle(ids.filter((id) => !sieger.has(id))),
  ];
  return dealIntoTables(reihenfolge, computeTableSizes(ids.length));
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
    // Eine Hälfte mit genau 5 Spielern ergäbe einen 5er-Tisch. Den gibt es
    // in der Liga nur, wenn überhaupt nur 5 da sind (Vereinsregel 4 > 3 > 5,
    // SPEC.md Abschnitt 3) — als "ein einziger Nicht-4er-Tisch" schnitte er
    // sonst besser ab als drei 3er und würde bevorzugt. Ab 6 Anwesenden gibt
    // es immer eine Grenze ohne 5er-Hälfte.
    if (obenSizes.includes(5) || untenSizes.includes(5)) continue;
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
 * am längsten bewährte Vermeidung). Dass Sieger zusammensitzen, ist keine
 * Gewichtung mehr, sondern eine feste Regel (siehe `assignHalf`).
 */
const GEWICHT_REMATCH = 3;
const GEWICHT_WIEDERHOLTER_NICHT_VIERER = 2;

/**
 * "Kosten" eines Tisches für die lokale Verbesserung — je niedriger,
 * desto besser. Rematches und wiederholte Nicht-4er-Zuteilungen erhöhen
 * die Kosten (siehe `verbessereZuteilung`).
 */
function bewerteTisch(
  table: readonly string[],
  previousPairings: ReadonlySet<string>,
  wiederholteNichtVierer: ReadonlySet<string>,
): number {
  let kosten = GEWICHT_REMATCH * countRematches(table, previousPairings);

  if (table.length !== 4) {
    kosten +=
      GEWICHT_WIEDERHOLTER_NICHT_VIERER *
      table.filter((id) => wiederholteNichtVierer.has(id)).length;
  }

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
 * 3. Innerhalb jeder Hälfte die Sieger der Vorrunde zusammen an die
 *    grössten Tische, die übrigen komplett zufällig — kein Rang-Bezug
 *    mehr (siehe `assignHalf`). Das verhindert, dass sich dieselbe kleine
 *    Gruppe (z.B. die besten 4-5) immer wieder an einem Tisch häuft, ein
 *    Effekt, den reines Zufalls-Rauschen auf einer durchgehenden
 *    Rangliste nicht auflösen konnte (siehe BACKLOG.md).
 * 4. Lokale Verbesserung (siehe `verbessereZuteilung`): zwei Nicht-Sieger
 *    *derselben Hälfte* dürfen getauscht werden, wenn das insgesamt die
 *    Kosten senkt — weniger Rematches, seltener zweimal an einem
 *    Nicht-4er-Tisch. Sieger bleiben, wo sie sind; getauscht wird nie über
 *    die Hälften-Grenze hinweg.
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
 *   Sie sitzen innerhalb ihrer Hälfte garantiert zusammen.
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
    const tables = assignHalf(sortiert.map((p) => p.id), sieger);
    if (hatVerbesserungspotential) {
      verbessereZuteilung(tables, previousPairings, wiederholteNichtVierer, sieger);
    }
    return tables;
  }

  const [oben, unten] = splitInHalves(sortiert);
  const obenTables = assignHalf(oben.map((p) => p.id), sieger);
  const untenTables = assignHalf(unten.map((p) => p.id), sieger);

  if (hatVerbesserungspotential) {
    // Getrennt pro Hälfte aufgerufen, damit ein Tausch nie über die
    // Hälften-Grenze hinweg stattfindet.
    verbessereZuteilung(obenTables, previousPairings, wiederholteNichtVierer, sieger);
    verbessereZuteilung(untenTables, previousPairings, wiederholteNichtVierer, sieger);
  }

  // Besteht eine Hälfte aus einem einzigen Tisch, kann sie innerhalb ihrer
  // selbst nichts tauschen — oben sässen dann in Runde 2 meist wieder
  // dieselben zusammen. Für diesen Fall dürfen die beiden Tische direkt an
  // der Grenze untereinander tauschen, aber nur, um Rematches aufzulösen.
  if (
    previousPairings.size > 0 &&
    (obenTables.length === 1 || untenTables.length === 1)
  ) {
    const rang = new Map(sortiert.map((p, i) => [p.id, i]));
    loeseRematchesAnDerGrenze(obenTables.at(-1)!, untenTables[0], previousPairings, rang, sieger);
  }

  return [...obenTables, ...untenTables];
}

/**
 * Wie viele Paare pro Tisch im Final-Ablauf schon zusammen gespielt haben
 * dürfen. Eines ist in Ordnung: ganz ohne rutschten zu viele Spieler weit
 * von ihrem Platz weg.
 */
const MAX_REMATCHES_PRO_TISCH = 1;

/**
 * Rang jedes Spielers innerhalb seines Tisches aus Match 1, gemessen an der
 * Rangliste nach Match 1 — gewichteter Schnitt pro Abend plus die Punkte
 * aus Match 1, also die Reihenfolge für Match 2 (0 = der Beste dieses
 * Tisches). Die Tische aus Match 1 ergeben sich aus den Paaren: wer mit
 * jemandem gespielt hat, sass mit ihm am Tisch.
 */
function rangImVortisch(
  rangfolge: readonly string[],
  previousPairings: ReadonlySet<string>,
): Map<string, number> {
  const rang = new Map<string, number>();
  rangfolge.forEach((id, i) => {
    const vorMir = rangfolge
      .slice(0, i)
      .filter((other) => previousPairings.has(pairKey(id, other))).length;
    rang.set(id, vorMir);
  });
  return rang;
}

/**
 * Wie viele Rematches an einem Tisch nicht das «richtige» Paar sind: von
 * den Spielern eines Tisches aus Match 1 dürfen nach der Rangliste nach
 * Match 1 nur Rang 1 und 3 bzw. Rang 2 und 4 wieder zusammensitzen
 * (Entscheid des Organisators vom 06.11.2026). Die zwei Besten eines
 * Tisches nie. Welches Paar das ist, hängt damit vom Verlauf von Match 1 ab.
 */
function falscheRematches(
  table: readonly string[],
  previousPairings: ReadonlySet<string>,
  rangVortisch: ReadonlyMap<string, number>,
): number {
  let count = 0;
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      if (!previousPairings.has(pairKey(table[i], table[j]))) continue;
      const abstand = Math.abs(rangVortisch.get(table[i])! - rangVortisch.get(table[j])!);
      if (abstand !== 2) count++;
    }
  }
  return count;
}

/**
 * Setzt die Spieler in der gegebenen Reihenfolge an die Tische: Platz 1–4
 * an Tisch 1 usw., kleinere Tische zuunterst (Final-Ablauf, SPEC.md
 * Abschnitt 5.4). Wer einen Tisch über `MAX_REMATCHES_PRO_TISCH` bringen
 * oder ein falsches Paar bilden würde (siehe `falscheRematches`), wird
 * übersprungen und rückt an den nächsten; bleibt am Ende ein Tisch darüber,
 * löst `loeseRematches` das auf. Die erlaubten Paare richten sich nach
 * derselben Reihenfolge `ids`.
 */
export function assignByPlace(
  ids: readonly string[],
  previousPairings: ReadonlySet<string> = new Set(),
): string[][] {
  const rest = [...ids];
  const rangVortisch = rangImVortisch(ids, previousPairings);
  const sizes = [...computeTableSizes(ids.length)].sort((a, b) => b - a);
  const tables = sizes.map((size) => {
    const table: string[] = [];
    while (table.length < size) {
      const frei = rest.findIndex((id) => {
        const mit = [...table, id];
        return (
          countRematches(mit, previousPairings) <= MAX_REMATCHES_PRO_TISCH &&
          falscheRematches(mit, previousPairings, rangVortisch) === 0
        );
      });
      table.push(rest.splice(Math.max(frei, 0), 1)[0]);
    }
    return table;
  });
  loeseRematches(tables, previousPairings, new Map(ids.map((id, i) => [id, i])), rangVortisch);
  return tables;
}

/**
 * Tauscht Spieler zwischen beliebigen Tischen, bis kein Tausch mehr etwas
 * bringt: zuerst kommen alle Tische auf `MAX_REMATCHES_PRO_TISCH` und ohne
 * falsches Paar (siehe `falscheRematches`), danach
 * rücken alle so nah wie möglich an ihren Platz in der Reihenfolge. Die
 * Abstände zählen im Quadrat, damit nicht einer sehr weit rutscht, nur damit
 * viele ein wenig näher sitzen. Geht es gar nicht (sehr kleines Feld), bleibt
 * die Lösung mit den wenigsten überzähligen Rematches.
 */
function loeseRematches(
  tables: string[][],
  previousPairings: ReadonlySet<string>,
  rang: ReadonlyMap<string, number>,
  rangVortisch: ReadonlyMap<string, number>,
): void {
  const GEWICHT_REMATCH_FINAL = 1e6;

  const ersterPlatz: number[] = [];
  tables.reduce((platz, table, i) => {
    ersterPlatz[i] = platz;
    return platz + table.length;
  }, 0);

  const kostenTisch = (t: number) => {
    const table = tables[t];
    const von = ersterPlatz[t];
    const bis = von + table.length - 1;
    const abstand = table.reduce((summe, id) => {
      const platz = rang.get(id)!;
      const weg = platz < von ? von - platz : platz > bis ? platz - bis : 0;
      return summe + weg * weg;
    }, 0);
    const zuViele = countRematches(table, previousPairings) - MAX_REMATCHES_PRO_TISCH;
    const falsche = falscheRematches(table, previousPairings, rangVortisch);
    return GEWICHT_REMATCH_FINAL * (Math.max(0, zuViele) + falsche) + abstand;
  };

  for (let pass = 0; pass < 500; pass++) {
    let best: { t: number; u: number; i: number; j: number; gain: number } | null = null;
    for (let t = 0; t < tables.length; t++) {
      for (let u = t + 1; u < tables.length; u++) {
        const [a, b] = [tables[t], tables[u]];
        const vorher = kostenTisch(t) + kostenTisch(u);
        for (let i = 0; i < a.length; i++) {
          for (let j = 0; j < b.length; j++) {
            [a[i], b[j]] = [b[j], a[i]];
            const gain = vorher - kostenTisch(t) - kostenTisch(u);
            [a[i], b[j]] = [b[j], a[i]];
            if (gain > 0 && (!best || gain > best.gain)) best = { t, u, i, j, gain };
          }
        }
      }
    }
    if (!best) return;
    const [a, b] = [tables[best.t], tables[best.u]];
    [a[best.i], b[best.j]] = [b[best.j], a[best.i]];
  }
}

/**
 * Tauscht Spieler zwischen dem untersten Tisch der oberen und dem obersten
 * Tisch der unteren Hälfte, solange das die Rematches an den beiden
 * Tischen senkt. Unter gleich guten Tauschen gewinnt der mit dem kleinsten
 * Rangabstand — es rutscht also eher ein Spieler knapp über der Grenze nach
 * unten als die Nummer 1. Alle übrigen Tische bleiben unberührt; die
 * Tischgrössen ändern sich nicht. Sieger werden nie getauscht — sie
 * sitzen fest mit den anderen Siegern ihrer Hälfte (siehe `assignHalf`).
 */
function loeseRematchesAnDerGrenze(
  oben: string[],
  unten: string[],
  previousPairings: ReadonlySet<string>,
  rang: ReadonlyMap<string, number>,
  sieger: ReadonlySet<string>,
): void {
  const rematches = () =>
    countRematches(oben, previousPairings) + countRematches(unten, previousPairings);

  for (let pass = 0; pass < 20; pass++) {
    const vorher = rematches();
    if (vorher === 0) return;

    let bester: { o: number; u: number; gewinn: number; abstand: number } | null = null;
    for (let o = 0; o < oben.length; o++) {
      for (let u = 0; u < unten.length; u++) {
        if (sieger.has(oben[o]) || sieger.has(unten[u])) continue;
        [oben[o], unten[u]] = [unten[u], oben[o]];
        const gewinn = vorher - rematches();
        [oben[o], unten[u]] = [unten[u], oben[o]];
        if (gewinn <= 0) continue;
        const abstand = Math.abs(rang.get(oben[o])! - rang.get(unten[u])!);
        if (
          !bester ||
          gewinn > bester.gewinn ||
          (gewinn === bester.gewinn && abstand < bester.abstand)
        ) {
          bester = { o, u, gewinn, abstand };
        }
      }
    }
    if (!bester) return;
    [oben[bester.o], unten[bester.u]] = [unten[bester.u], oben[bester.o]];
  }
}

/**
 * Tauscht Spieler zwischen zwei Tischen (innerhalb der übergebenen Liste),
 * wenn das insgesamt die Kosten senkt (siehe `bewerteTisch`) — weniger
 * Rematches, seltener eine wiederholte Nicht-4er-Zuteilung. Es gibt keine
 * Bedingung an die Sortierwerte der Tauschenden — innerhalb einer Hälfte
 * sind ohnehin alle Spieler gleichwertig austauschbar (siehe
 * `assignLeagueRound`). Ausgenommen sind die Sieger: sie sitzen fest
 * zusammen (siehe `assignHalf`).
 */
function verbessereZuteilung(
  tables: string[][],
  previousPairings: ReadonlySet<string>,
  wiederholteNichtVierer: ReadonlySet<string>,
  sieger: ReadonlySet<string>,
): void {
  const MAX_PASSES = 20;
  const kosten = (table: readonly string[]) =>
    bewerteTisch(table, previousPairings, wiederholteNichtVierer);

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
            if (sieger.has(playerA) || sieger.has(playerB)) continue;

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
