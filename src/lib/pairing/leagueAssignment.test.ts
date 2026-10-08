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
    // N=10: 4/6 und 6/4 ergeben je 2 Nicht-4er-Tische insgesamt (ein
    // 4er + zwei 3er auf der 6er-Seite), 5/5 ergibt zwei 5er-Tische (auch
    // 2 insgesamt) — bei gleicher Gesamtzahl gewinnt 4/6, weil dort die
    // obere Hälfte nicht betroffen ist (siehe nächster Test).
    const players = makePlayers(Array.from({ length: 10 }, (_, i) => 100 - i));
    const tables = assignLeagueRound(players);

    const oben = new Set(["p0", "p1", "p2", "p3"]);
    const unten = new Set(["p4", "p5", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });

  it("drückt einen unvermeidbaren Nicht-4er-Tisch konsequent in die untere Hälfte", () => {
    // N=11: sowohl Grenze=4 (Tischgrössen 4/[4,3]) als auch Grenze=7
    // ([4,3]/4) ergeben insgesamt genau einen Nicht-4er-Tisch — aber nur
    // bei Grenze=4 landet er in der unteren (schwächeren) Hälfte. Die
    // Grenze muss deshalb immer bei 4 liegen, nie bei 7.
    const players = makePlayers(Array.from({ length: 11 }, (_, i) => 100 - i));
    for (let i = 0; i < 300; i++) {
      const tables = assignLeagueRound(players);
      const tableMitP4 = tables.find((t) => t.includes("p4"))!;
      // Bei Grenze=7 wäre p4 (Position 4) noch Teil der oberen Hälfte,
      // also am selben Tisch wie p0 möglich.
      expect(tableMitP4.includes("p0")).toBe(false);
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

  it("wählt bei mehreren gleichwertigen Grenzen (ohne Nicht-4er-Unterschied) zufällig eine davon", () => {
    // N=20: sowohl Grenze=8 als auch Grenze=12 ergeben durchgehend
    // 4er-Tische auf beiden Seiten (keine Nicht-4er-Tische, also auch
    // kein Unterschied für die obere Hälfte) und liegen gleich weit von
    // der exakten Mitte entfernt — beide sollten über genügend Ziehungen
    // vorkommen.
    const players = makePlayers(Array.from({ length: 20 }, (_, i) => 100 - i));
    let p8MitP19 = 0; // nur möglich, wenn die Grenze bei 8 liegt (p8 dann unten)
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const tables = assignLeagueRound(players);
      const tableMitP8 = tables.find((t) => t.includes("p8"))!;
      if (tableMitP8.includes("p19")) p8MitP19++;
    }
    // Läge die Grenze immer bei 12 (p8 stets in der oberen Hälfte), könnte
    // p8 nie mit p19 (immer unten) am selben Tisch sitzen.
    expect(p8MitP19).toBeGreaterThan(0);
  });

  it("verteilt innerhalb einer Hälfte komplett zufällig, nicht nach Rang", () => {
    // N=16: obere Hälfte hat 8 Spieler auf 2 Tischen zu 4 — genug Raum,
    // damit sich unterschiedliche Tischnachbarn zeigen können (bei nur 4
    // Personen in der ganzen Hälfte gäbe es nur eine mögliche Gruppe).
    const players = makePlayers(Array.from({ length: 16 }, (_, i) => 100 - i));

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
  // N=10: einzige optimale Grenze ist 4 (siehe Test oben), damit bleiben
  // diese Tests deterministisch auswertbar.
  const alsSieg = (ids: string[], sieger: string[]) =>
    ids.map((id, i) => ({ id, points: -i + (sieger.includes(id) ? 4 : 0) }));

  it("ein Sieg an der Hälften-Grenze kann in die stärkere Hälfte heben", () => {
    // 10 Spieler, Grenze=4 (ohne Bonus: p0-p3 oben, p4-p9 unten). p5
    // gewinnt: Wert -5+4=-1, gleichauf mit p1 (-1) — durch stabile
    // Sortierung rutscht p5 damit vor p2/p3 in die obere Haelfte
    // (statt p3, der als schwaechster der ehemals oberen Haelfte
    // verdraengt wird).
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const bewertet = alsSieg(ids, ["p5"]);
    const tables = assignLeagueRound(bewertet);

    const oben = new Set(["p0", "p1", "p5", "p2"]);
    const unten = new Set(["p3", "p4", "p6", "p7", "p8", "p9"]);
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
    // von Position 9 in die obere Haelfte (Positionen 0-3) zu gelangen.
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
    const oben = new Set(["p0", "p1", "p2", "p3"]);
    const unten = new Set(["p4", "p5", "p6", "p7", "p8", "p9"]);
    for (const table of tables) {
      const hatOben = table.some((id) => oben.has(id));
      const hatUnten = table.some((id) => unten.has(id));
      expect(hatOben && hatUnten).toBe(false);
    }
  });
});

describe("wiederholte Nicht-4er-Zuteilung vermeiden", () => {
  it("vermeidet, dass dieselbe Person zweimal an einem Nicht-4er-Tisch sitzt", () => {
    // N=11, Grenze=4: untere Hälfte hat 7 Spieler -> Tischgrössen [4,3].
    // Angenommen, p4-p7 sassen die Vorrunde schon an einem 3er.
    const players = makePlayers(Array.from({ length: 11 }, (_, i) => 100 - i));
    const wiederholteNichtVierer = new Set(["p4", "p5", "p6", "p7"]);

    let mitVermeidungAn3er = 0;
    let ohneVermeidungAn3er = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const mit = assignLeagueRound(players, new Set(), wiederholteNichtVierer);
      const dreierMit = mit.find((t) => t.length === 3)!;
      mitVermeidungAn3er += dreierMit.filter((id) => wiederholteNichtVierer.has(id)).length;

      const ohne = assignLeagueRound(players);
      const dreierOhne = ohne.find((t) => t.length === 3)!;
      ohneVermeidungAn3er += dreierOhne.filter((id) => wiederholteNichtVierer.has(id)).length;
    }
    expect(mitVermeidungAn3er).toBeLessThan(ohneVermeidungAn3er);
  });

  it("tauscht dabei nie über die Hälften-Grenze hinweg", () => {
    const players = makePlayers(Array.from({ length: 11 }, (_, i) => 100 - i));
    const wiederholteNichtVierer = new Set(["p0", "p1", "p2", "p3"]); // obere Haelfte

    for (let i = 0; i < 100; i++) {
      const tables = assignLeagueRound(players, new Set(), wiederholteNichtVierer);
      const tableMitP4 = tables.find((t) => t.includes("p4"))!;
      // p4 (untere Haelfte) darf nie mit p0 (obere Haelfte) getauscht werden,
      // egal wie sehr die Vermeidung versucht, p0-p3 aus dem 3er zu holen.
      expect(tableMitP4.includes("p0")).toBe(false);
    }
  });
});

describe("Sieger bevorzugt zusammen sitzen lassen", () => {
  it("erhöht die Chance, dass zwei Sieger am selben Tisch landen", () => {
    // N=16, Grenze=8: obere Haelfte auf 2 Tischen zu 4.
    const players = makePlayers(Array.from({ length: 16 }, (_, i) => 100 - i));
    const sieger = new Set(["p0", "p2", "p4", "p6"]); // 4 Sieger, alle oben

    function siegerPaareAmTisch(tables: string[][]): number {
      let paare = 0;
      for (const table of tables) {
        const s = table.filter((id) => sieger.has(id)).length;
        paare += (s * (s - 1)) / 2;
      }
      return paare;
    }

    let mitBonus = 0;
    let ohneBonus = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      const mit = assignLeagueRound(players, new Set(), new Set(), sieger);
      mitBonus += siegerPaareAmTisch(mit);
      const ohne = assignLeagueRound(players);
      ohneBonus += siegerPaareAmTisch(ohne);
    }
    expect(mitBonus).toBeGreaterThan(ohneBonus);
  });
});
