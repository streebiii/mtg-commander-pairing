import { describe, expect, it } from "vitest";
import {
  assignLeagueRound,
  pairKey,
  tablePairKeys,
  countRematches,
  type RankedPlayer,
} from "./leagueAssignment";
import { PairingError } from "./errors";

function makePlayers(pointsList: number[]): RankedPlayer[] {
  return pointsList.map((points, i) => ({ id: `p${i}`, points }));
}

describe("assignLeagueRound", () => {
  it("teilt alle Spieler auf gültige Tischgrößen auf, ohne Duplikate oder Verlust", () => {
    const players = makePlayers([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]); // N=11
    const tables = assignLeagueRound(players);

    const allAssigned = tables.flat();
    expect(allAssigned.length).toBe(players.length);
    expect(new Set(allAssigned).size).toBe(players.length); // keine Duplikate
    for (const table of tables) {
      expect(table.length).toBeGreaterThanOrEqual(3);
      expect(table.length).toBeLessThanOrEqual(5);
    }
  });

  it("teilt das Feld in eine obere und eine untere Hälfte — die obere bekommt bei ungerader Anzahl die zusätzliche Person", () => {
    // 0 Unschärfe, damit die Grenze exakt bei der Mitte liegt (deterministisch testbar).
    const players = makePlayers(Array.from({ length: 11 }, (_, i) => 100 - i)); // N=11, Ceil(11/2)=6
    const tables = assignLeagueRound(players, new Set(), 0);

    // p0..p5 (obere Haelfte, 6 Spieler) duerfen nie mit p6..p10 (untere
    // Haelfte, 5 Spieler) am selben Tisch sitzen.
    const oben = new Set(["p0", "p1", "p2", "p3", "p4", "p5"]);
    const unten = new Set(["p6", "p7", "p8", "p9", "p10"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });

  it("garantiert über viele Ziehungen: die obere Hälfte trifft nie die untere Hälfte", () => {
    const players = makePlayers(Array.from({ length: 28 }, (_, i) => 100 - i)); // N=28
    // Mit Standard-Unschaerfe (GRENZ_UNSCHAERFE=1), nicht 0 — genau das
    // soll real vorkommende Verhalten pruefen, nicht nur den Idealfall.
    // Mitte liegt bei 14, die Grenze kann also zwischen 13 und 15 liegen
    // (siehe GRENZ_UNSCHAERFE-Dokumentation) — mit Sicherheitsabstand
    // dazu gewaehlt, damit die Testgruppen selbst bei maximaler
    // Verschiebung nie ineinander uebergehen.
    const oben = new Set(Array.from({ length: 12 }, (_, i) => `p${i}`)); // p0-p11
    const weitUnten = new Set(
      Array.from({ length: 12 }, (_, i) => `p${16 + i}`), // p16-p27
    );

    for (let i = 0; i < 300; i++) {
      const tables = assignLeagueRound(players);
      for (const table of tables) {
        const hatOben = table.some((id) => oben.has(id));
        const hatWeitUnten = table.some((id) => weitUnten.has(id));
        expect(hatOben && hatWeitUnten).toBe(false);
      }
    }
  });

  it("verteilt innerhalb einer Hälfte komplett zufällig, nicht nach Rang", () => {
    // Enge, aber unterscheidbare Punkteabstaende innerhalb der oberen
    // Haelfte (p0..p5 bei N=11).
    const players = makePlayers([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

    const seenArrangements = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players, new Set(), 0);
      const tableMitP0 = tables.find((t) => t.includes("p0"))!;
      seenArrangements.add([...tableMitP0].sort().join(","));
    }

    // Waere die Verteilung innerhalb der Haelfte weiterhin nach Rang
    // sortiert (wie frueher, Block+Jitter), saehe man kaum Variation.
    // Komplett zufaellig muss p0 im Lauf vieler Ziehungen mit ganz
    // unterschiedlichen Tischnachbarn aus der oberen Haelfte landen.
    expect(seenArrangements.size).toBeGreaterThan(3);
  });

  it("lässt die Trennlinie bei GRENZ_UNSCHAERFE=0 nie verrutschen (Grenzfall exakt reproduzierbar)", () => {
    const players = makePlayers(Array.from({ length: 10 }, (_, i) => 100 - i)); // N=10, Mitte=5
    for (let i = 0; i < 50; i++) {
      const tables = assignLeagueRound(players, new Set(), 0);
      const tableMitP4 = tables.find((t) => t.includes("p4"))!; // letzter der oberen Haelfte
      // p4 darf nie mit jemandem aus der unteren Haelfte (p5..p9) sitzen.
      expect(tableMitP4.some((id) => ["p5", "p6", "p7", "p8", "p9"].includes(id))).toBe(
        false,
      );
    }
  });

  it("mit Unschärfe kann die Grenze knapp benachbarte Ränge gelegentlich zusammenbringen", () => {
    const players = makePlayers(Array.from({ length: 10 }, (_, i) => 100 - i)); // N=10, Mitte=5
    let p4TrifftP5 = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const tables = assignLeagueRound(players, new Set(), 1); // Unschaerfe 1
      const tableMitP4 = tables.find((t) => t.includes("p4"))!;
      if (tableMitP4.includes("p5")) p4TrifftP5++;
    }
    // Bei GRENZ_UNSCHAERFE=0 waere das immer 0 — mit Unschaerfe muss es
    // in einem spuerbaren Teil der Ziehungen vorkommen.
    expect(p4TrifftP5).toBeGreaterThan(0);
  });

  it("bleibt bei sehr kleinen Abenden (< 6 Anwesende) eine einzige Gruppe, ohne Fehler", () => {
    for (const n of [3, 4, 5]) {
      const players = makePlayers(Array.from({ length: n }, (_, i) => 10 - i));
      expect(() => assignLeagueRound(players)).not.toThrow();
      const tables = assignLeagueRound(players);
      expect(tables.flat().length).toBe(n);
    }
  });

  it("wirft PairingError bei weniger als drei Spielern", () => {
    const players = makePlayers([1, 2]);
    expect(() => assignLeagueRound(players)).toThrow(PairingError);
  });

  it("reduziert Rematches durch Tausch innerhalb einer Hälfte", () => {
    // 16 Spieler -> obere Haelfte (Mitte=8) p0..p7, verteilt auf 2 Tische
    // zu je 4 — erst ab zwei Tischen pro Haelfte gibt es zwischen ihnen
    // ueberhaupt etwas zu tauschen (bei genau 4 waere es ein einziger
    // Tisch, an dem sich nichts aendern liesse).
    const players = makePlayers(
      Array.from({ length: 16 }, (_, i) => 100 - i),
    );
    // Eine konkrete Vierergruppe aus der oberen Haelfte, die schon einmal
    // zusammensass.
    const previousPairings = new Set(tablePairKeys(["p0", "p1", "p2", "p3"]));

    let totalRematchesMitVermeidung = 0;
    let totalRematchesOhneVermeidung = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const mit = assignLeagueRound(players, previousPairings, 0);
      totalRematchesMitVermeidung += mit.reduce(
        (s, t) => s + countRematches(t, previousPairings),
        0,
      );
      const ohne = assignLeagueRound(players, new Set(), 0);
      totalRematchesOhneVermeidung += ohne.reduce(
        (s, t) => s + countRematches(t, previousPairings),
        0,
      );
    }
    expect(totalRematchesMitVermeidung).toBeLessThan(totalRematchesOhneVermeidung);
  });

  it("tauscht bei der Rematch-Vermeidung nie über die Hälften-Grenze hinweg", () => {
    // p0..p3 obere Haelfte, p4..p7 untere Haelfte. Simuliere eine
    // Vorrunde, in der (hypothetisch) alle in der oberen Haelfte
    // zusammen sassen — die Vermeidung darf trotzdem niemanden aus der
    // unteren Haelfte heranziehen.
    const players = makePlayers([100, 90, 80, 70, 60, 50, 40, 30]);
    const previousPairings = new Set(tablePairKeys(["p0", "p1", "p2", "p3"]));

    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players, previousPairings, 0);
      const oben = new Set(["p0", "p1", "p2", "p3"]);
      const unten = new Set(["p4", "p5", "p6", "p7"]);
      for (const table of tables) {
        const hatOben = table.some((id) => oben.has(id));
        const hatUnten = table.some((id) => unten.has(id));
        expect(hatOben && hatUnten).toBe(false);
      }
    }
  });
});

describe("pairKey", () => {
  it("ist unabhängig von der Reihenfolge", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
});

describe("Paarung der zweiten Runde nach dem Sieg (SPEC.md Abschnitt 5)", () => {
  // Der Sieg-Bonus wirkt sich vor allem an der Grenze zwischen oberer und
  // unterer Haelfte aus (siehe SIEG_BONUS_RAENGE in leagueRanking.ts).
  const alsSieg = (ids: string[], sieger: string[]) =>
    ids.map((id, i) => ({ id, points: -i + (sieger.includes(id) ? 4 : 0) }));

  it("ein Sieg an der Hälften-Grenze kann in die stärkere Hälfte heben", () => {
    // 10 Spieler, Mitte=5 (ohne Bonus: p0-p4 oben, p5-p9 unten). p5
    // gewinnt: Wert -5+4=-1, gleichauf mit p1 (-1) — durch stabile
    // Sortierung rutscht p5 damit sicher in die obere Haelfte (statt
    // p4, der als schwaechster der ehemals oberen Haelfte verdraengt wird).
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, ["p5"]);
    const tables = assignLeagueRound(bewertet, new Set(), 0);

    const oben = new Set(["p0", "p1", "p5", "p2", "p3"]);
    const unten = new Set(["p4", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
    // p5 sitzt tatsaechlich in der oberen Haelfte, nie mit der unteren.
    const tableMitP5 = tables.find((t) => t.includes("p5"))!;
    expect(tableMitP5.some((id) => unten.has(id))).toBe(false);
  });

  it("ein Sieg weit weg von der Grenze ändert nichts an der Hälfte", () => {
    // p9 (letzter Platz) gewinnt — +4 Raenge reicht bei weitem nicht, um
    // von Position 9 in die obere Haelfte (Positionen 0-4) zu gelangen.
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, ["p9"]);

    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(bewertet, new Set(), 0);
      const tableMitP9 = tables.find((t) => t.includes("p9"))!;
      // p9 darf trotz Sieg nie mit der Spitze (p0) am selben Tisch sitzen.
      expect(tableMitP9.includes("p0")).toBe(false);
    }
  });

  it("ohne Sieger verhält sich Runde 2 wie Runde 1 (reine Rangfolge)", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, []);
    const tables = assignLeagueRound(bewertet, new Set(), 0);
    const oben = new Set(["p0", "p1", "p2", "p3", "p4"]);
    const unten = new Set(["p5", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });
});
