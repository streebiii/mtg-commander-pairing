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

  it("erzeugt bei einer durch 4 teilbaren Gesamtzahl keine unnötigen Nicht-4er-Tische", () => {
    // 28 Spieler: die exakte Mitte (14/14) ergäbe pro Hälfte [4,4,3,3] —
    // 4 Nicht-4er-Tische, obwohl das Gesamtfeld rein rechnerisch 7×4
    // hergibt (12/16 oder 16/12 teilt fehlerfrei auf). Genau das war der
    // gemeldete Bug: die Grenze darf nicht stur bei n/2 liegen.
    const players = makePlayers(Array.from({ length: 28 }, (_, i) => 100 - i));
    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players);
      for (const table of tables) {
        expect(table.length).toBe(4);
      }
    }
  });

  it("teilt das Feld in eine obere und eine untere Hälfte — die Grenze liegt dort, wo am wenigsten Nicht-4er-Tische entstehen", () => {
    // N=10: einzige optimale Grenze ist exakt die Mitte (5/5) — bei 4/6
    // oder 6/4 entstünde je ein zusätzlicher Nicht-4er-Tisch.
    const players = makePlayers(Array.from({ length: 10 }, (_, i) => 100 - i));
    const tables = assignLeagueRound(players);

    const oben = new Set(["p0", "p1", "p2", "p3", "p4"]);
    const unten = new Set(["p5", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });

  it("garantiert über viele Ziehungen: die obere Hälfte trifft nie die untere Hälfte", () => {
    const players = makePlayers(Array.from({ length: 28 }, (_, i) => 100 - i)); // N=28
    // Optimale Grenzen liegen bei 12 oder 16 (siehe Test oben) — mit
    // Sicherheitsabstand dazu gewählt, damit die Testgruppen unabhängig
    // davon, welche der beiden gezogen wird, nie ineinander übergehen.
    const oben = new Set(Array.from({ length: 10 }, (_, i) => `p${i}`)); // p0-p9
    const weitUnten = new Set(
      Array.from({ length: 10 }, (_, i) => `p${18 + i}`), // p18-p27
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

  it("wählt bei mehreren gleichwertigen Grenzen zufällig eine davon", () => {
    // N=11: sowohl 4/7 als auch 7/4 ergeben gleich viele Nicht-4er-Tische
    // (je einen) und liegen gleich weit von der exakten Mitte entfernt —
    // beide Grenzen sollten über genügend Ziehungen vorkommen.
    const players = makePlayers(Array.from({ length: 11 }, (_, i) => 100 - i));
    let p4MitP9 = 0; // nur möglich, wenn die Grenze bei 4 liegt (p4 dann unten)
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const tables = assignLeagueRound(players);
      const tableMitP4 = tables.find((t) => t.includes("p4"))!;
      if (tableMitP4.includes("p9")) p4MitP9++;
    }
    // Läge die Grenze immer bei 7 (p4 stets in der oberen Hälfte), könnte
    // p4 nie mit p9 (immer unten) am selben Tisch sitzen.
    expect(p4MitP9).toBeGreaterThan(0);
  });

  it("verteilt innerhalb einer Hälfte komplett zufällig, nicht nach Rang", () => {
    const players = makePlayers([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

    const seenArrangements = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players);
      const tableMitP0 = tables.find((t) => t.includes("p0"))!;
      seenArrangements.add([...tableMitP0].sort().join(","));
    }

    // Wäre die Verteilung innerhalb der Hälfte weiterhin nach Rang
    // sortiert (wie früher, Block+Jitter), sähe man kaum Variation.
    expect(seenArrangements.size).toBeGreaterThan(3);
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
    // 16 Spieler -> einzige optimale Grenze ist die exakte Mitte (8/8),
    // verteilt auf je 2 Tische zu 4 — erst ab zwei Tischen pro Hälfte
    // gibt es zwischen ihnen überhaupt etwas zu tauschen (bei genau 4
    // wäre es ein einziger Tisch, an dem sich nichts ändern liesse).
    const players = makePlayers(
      Array.from({ length: 16 }, (_, i) => 100 - i),
    );
    // Eine konkrete Vierergruppe aus der oberen Hälfte, die schon einmal
    // zusammensass.
    const previousPairings = new Set(tablePairKeys(["p0", "p1", "p2", "p3"]));

    let totalRematchesMitVermeidung = 0;
    let totalRematchesOhneVermeidung = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const mit = assignLeagueRound(players, previousPairings);
      totalRematchesMitVermeidung += mit.reduce(
        (s, t) => s + countRematches(t, previousPairings),
        0,
      );
      const ohne = assignLeagueRound(players, new Set());
      totalRematchesOhneVermeidung += ohne.reduce(
        (s, t) => s + countRematches(t, previousPairings),
        0,
      );
    }
    expect(totalRematchesMitVermeidung).toBeLessThan(totalRematchesOhneVermeidung);
  });

  it("tauscht bei der Rematch-Vermeidung nie über die Hälften-Grenze hinweg", () => {
    // 8 Spieler -> einzige optimale Grenze ist die exakte Mitte (4/4).
    // Simuliere eine Vorrunde, in der (hypothetisch) alle in der oberen
    // Hälfte zusammensassen — die Vermeidung darf trotzdem niemanden aus
    // der unteren Hälfte heranziehen.
    const players = makePlayers([100, 90, 80, 70, 60, 50, 40, 30]);
    const previousPairings = new Set(tablePairKeys(["p0", "p1", "p2", "p3"]));

    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players, previousPairings);
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
  // N=10: einzige optimale Grenze ist die exakte Mitte (5/5, siehe Test
  // oben), damit bleiben diese Tests deterministisch auswertbar.
  const alsSieg = (ids: string[], sieger: string[]) =>
    ids.map((id, i) => ({ id, points: -i + (sieger.includes(id) ? 4 : 0) }));

  it("ein Sieg an der Hälften-Grenze kann in die stärkere Hälfte heben", () => {
    // 10 Spieler, Mitte=5 (ohne Bonus: p0-p4 oben, p5-p9 unten). p5
    // gewinnt: Wert -5+4=-1, gleichauf mit p1 (-1) — durch stabile
    // Sortierung rutscht p5 damit sicher in die obere Haelfte (statt
    // p4, der als schwaechster der ehemals oberen Haelfte verdraengt wird).
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, ["p5"]);
    const tables = assignLeagueRound(bewertet);

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
      const tables = assignLeagueRound(bewertet);
      const tableMitP9 = tables.find((t) => t.includes("p9"))!;
      // p9 darf trotz Sieg nie mit der Spitze (p0) am selben Tisch sitzen.
      expect(tableMitP9.includes("p0")).toBe(false);
    }
  });

  it("ohne Sieger verhält sich Runde 2 wie Runde 1 (reine Rangfolge)", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, []);
    const tables = assignLeagueRound(bewertet);
    const oben = new Set(["p0", "p1", "p2", "p3", "p4"]);
    const unten = new Set(["p5", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });
});
