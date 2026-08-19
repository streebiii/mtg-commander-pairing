import { describe, expect, it } from "vitest";
import {
  assignLeagueRound,
  pairKey,
  tablePairKeys,
  countRematches,
  type RankedPlayer,
} from "./leagueAssignment";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";

function makePlayers(pointsList: number[]): RankedPlayer[] {
  return pointsList.map((points, i) => ({ id: `p${i}`, points }));
}

describe("assignLeagueRound", () => {
  it("teilt alle Spieler auf die richtige Anzahl Tische mit den korrekten Größen auf", () => {
    const players = makePlayers([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]); // N=11
    const sizes = computeTableSizes(players.length); // [4,4,3]
    const tables = assignLeagueRound(players, sizes);

    expect(tables.map((t) => t.length).sort()).toEqual([...sizes].sort());
    const allAssigned = tables.flat();
    expect(allAssigned.length).toBe(players.length);
    expect(new Set(allAssigned).size).toBe(players.length); // keine Duplikate
  });

  it("gruppiert nach Rang: die Top-N Spieler landen an den vorderen Tischen", () => {
    const players = makePlayers([100, 90, 80, 70, 60, 50, 40]); // N=7 -> [4,3]
    const sizes = computeTableSizes(players.length);
    const tables = assignLeagueRound(players, sizes);

    // Tisch mit Größe 4 sollte die 4 höchsten Punktestände enthalten (p0..p3)
    const fourTable = tables.find((t) => t.length === 4)!;
    const threeTable = tables.find((t) => t.length === 3)!;
    expect(new Set(fourTable)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
    expect(new Set(threeTable)).toEqual(new Set(["p4", "p5", "p6"]));
  });

  it("wirft PairingError bei nicht passender Tischgrößen-Summe", () => {
    const players = makePlayers([1, 2, 3]);
    expect(() => assignLeagueRound(players, [4])).toThrow(PairingError);
  });

  it("nutzt punktegleiche Randspieler, um eine vermeidbare Rematch-Paarung aufzulösen", () => {
    // 8 Spieler -> Tischgrößen [4,4]. p4 und p5 liegen genau auf der
    // Block-Grenze und haben denselben Punktestand, sind also austauschbar,
    // ohne die Rang-Gruppierung zu verletzen.
    const players: RankedPlayer[] = [
      { id: "p1", points: 100 },
      { id: "p2", points: 90 },
      { id: "p3", points: 80 },
      { id: "p4", points: 70 },
      { id: "p5", points: 70 }, // gleicher Punktestand wie p4
      { id: "p6", points: 60 },
      { id: "p7", points: 50 },
      { id: "p8", points: 40 },
    ];
    const sizes = computeTableSizes(players.length); // [4,4]

    // Eine frühere Runde hatte exakt {p1,p2,p3,p4} an einem Tisch.
    const previousPairings = new Set<string>(
      tablePairKeys(["p1", "p2", "p3", "p4"]),
    );

    const round2 = assignLeagueRound(players, sizes, previousPairings);

    const rematches = round2.reduce(
      (sum, table) => sum + countRematches(table, previousPairings),
      0,
    );

    // p1, p2 und p3 sitzen durch die Rang-Gruppierung zwangsläufig auch in
    // Runde 2 zusammen (waren es schon in Runde 1) — das sind 3 unvermeidbare
    // Rematches (p1p2, p1p3, p2p3). Vermeidbar sind nur die drei Paarungen
    // mit p4 (p1p4, p2p4, p3p4), wenn stattdessen p5 an den Tisch kommt.
    // Ohne den Tausch punktegleicher Randspieler wären es 6 Rematches
    // (p4 bleibt beim Top-Tisch); mit optimalem Tausch sind es minimal 3.
    // Egal wie die Zufalls-Tiebreak-Reihenfolge zwischen p4/p5 zu Beginn
    // ausfällt, muss der Algorithmus dieses Minimum erreichen.
    expect(rematches).toBe(3);

    // Die Rang-Gruppierung bleibt dabei erhalten: p1,p2,p3 sitzen weiterhin
    // zusammen an einem Tisch, ergänzt um genau einen der punktegleichen
    // Spieler p4/p5.
    const topTable = round2.find((t) => t.includes("p1"))!;
    expect(topTable).toHaveLength(4);
    expect(topTable).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(
      topTable.filter((id) => id === "p4" || id === "p5"),
    ).toHaveLength(1);
  });

  it("tauscht niemals Spieler mit unterschiedlichem Punktestand (Rang-Gruppierung bleibt erhalten)", () => {
    // Große Abstände (Vielfache von 100), damit das Zufalls-Rauschen
    // (RANK_JITTER_POINTS) die Rang-Reihenfolge nicht durcheinanderbringt —
    // dieser Test prüft gezielt Schritt 3 (Tausch-Logik), nicht Schritt 1.
    const players = makePlayers([1000, 900, 800, 700, 600, 500, 400]);
    const sizes = computeTableSizes(players.length);
    const previousPairings = new Set(["p0|p1"]); // erzwingt einen Verbesserungsversuch
    const tables = assignLeagueRound(players, sizes, previousPairings);

    const pointsById = new Map(players.map((p) => [p.id, p.points]));
    // Die Menge der Punktestände pro Tischgröße darf sich durch Tausch nicht
    // ändern, da nur punktegleiche Spieler getauscht werden dürfen — hier
    // gibt es aber gar keine Punktegleichheit, also darf sich nichts ändern.
    const fourTable = tables.find((t) => t.length === 4)!;
    expect(new Set(fourTable.map((id) => pointsById.get(id)))).toEqual(
      new Set([1000, 900, 800, 700]),
    );
  });

  it("nutzt RANK_JITTER_POINTS, um die Tischzuteilung von Abend zu Abend zu variieren", () => {
    // Eng beieinanderliegende Punktestände (1 Punkt Abstand) sollen dank
    // Jitter NICHT immer zur exakt gleichen Tischaufteilung führen.
    const players = makePlayers([10, 9, 8, 7, 6, 5, 4, 3]); // N=8 -> [4,4]
    const sizes = computeTableSizes(players.length);

    const seenArrangements = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const tables = assignLeagueRound(players, sizes);
      const fourTable = tables.find((t) => t.length === 4)!;
      seenArrangements.add([...fourTable].sort().join(","));
    }

    // Mit striktem Rang-Grouping (kein Jitter) gäbe es hier immer nur genau
    // EINE mögliche Tischaufteilung (p0-p3 zusammen). Mit Jitter sollten
    // über 50 Versuche mehrere unterschiedliche Aufteilungen auftauchen.
    expect(seenArrangements.size).toBeGreaterThan(1);
  });

  it("mischt bei großem Punkteabstand nie über die Tischgrenze hinweg (Jitter bleibt begrenzt)", () => {
    // Abstand von 100 Punkten ist weit größer als 2x RANK_JITTER_POINTS (6),
    // die Top-4 dürfen also nie mit den unteren 3 gemischt werden.
    const players = makePlayers([700, 600, 500, 400, 300, 200, 100]);
    const sizes = computeTableSizes(players.length); // [4,3]

    for (let i = 0; i < 50; i++) {
      const tables = assignLeagueRound(players, sizes);
      const fourTable = tables.find((t) => t.length === 4)!;
      expect(new Set(fourTable)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
    }
  });
});

describe("pairKey", () => {
  it("ist unabhängig von der Reihenfolge", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
});
