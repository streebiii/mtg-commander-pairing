import { describe, expect, it } from "vitest";
import { assignSkillBalancedCasualRound, type SkillRatedPlayer } from "./skillAssignment";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";

function makePlayers(levels: number[]): SkillRatedPlayer[] {
  return levels.map((skillLevel, i) => ({ id: `p${i}`, skillLevel }));
}

describe("assignSkillBalancedCasualRound", () => {
  it("gruppiert nach Skill: stärkste Spieler landen zusammen an einem Tisch", () => {
    // Große Abstände, damit Jitter (±1) nie über eine Gruppe hinweg mischt.
    const players = makePlayers([50, 50, 50, 50, 10, 10, 10]); // N=7 -> [4,3]
    const sizes = computeTableSizes(players.length);
    const tables = assignSkillBalancedCasualRound(players, sizes);

    const fourTable = tables.find((t) => t.length === 4)!;
    expect(new Set(fourTable)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
  });

  it("verteilt unbewertete Spieler (0) zufällig — mal an den starken, mal an den schwachen Tisch", () => {
    // 3 erfahrene (3), 3 schwache (1) und ein unbewerteter Spieler (0).
    // N=7 -> [4,3]. Für den Unbewerteten wird pro Berechnung eine Stufe
    // gewürfelt, er muss deshalb über viele Läufe an BEIDEN Tischen
    // auftauchen. Würde 0 buchstäblich als schwächste Stufe gewertet,
    // landete er immer beim schwachen Block; als fixer Mittelwert wäre die
    // Verteilung ebenfalls einseitig.
    const players: SkillRatedPlayer[] = [
      { id: "s1", skillLevel: 3 },
      { id: "s2", skillLevel: 3 },
      { id: "s3", skillLevel: 3 },
      { id: "w1", skillLevel: 1 },
      { id: "w2", skillLevel: 1 },
      { id: "w3", skillLevel: 1 },
      { id: "u1", skillLevel: 0 },
    ];
    const sizes = computeTableSizes(players.length); // [4,3]

    let beiDenStarken = false;
    let beiDenSchwachen = false;
    for (let i = 0; i < 200; i++) {
      const tables = assignSkillBalancedCasualRound(players, sizes);
      const tischMitU1 = tables.find((t) => t.includes("u1"))!;
      if (tischMitU1.includes("s1")) beiDenStarken = true;
      if (tischMitU1.includes("w1")) beiDenSchwachen = true;
      if (beiDenStarken && beiDenSchwachen) break;
    }
    expect(beiDenStarken).toBe(true);
    expect(beiDenSchwachen).toBe(true);
  });

  it("verteilt korrekt, wenn kein einziger Spieler bewertet ist", () => {
    // Alle unbewertet -> alle bekommen gewürfelte Werte -> rein zufällige
    // Gruppierung. Der Test prüft, dass es nicht crasht und jeder Spieler
    // genau einmal zugeteilt wird.
    const players = makePlayers([0, 0, 0, 0, 0, 0, 0]);
    const sizes = computeTableSizes(players.length);
    const tables = assignSkillBalancedCasualRound(players, sizes);

    expect(tables.flat().length).toBe(7);
    expect(new Set(tables.flat()).size).toBe(7);
  });

  it("mischt bei großem Skill-Abstand nie über die Tischgrenze hinweg", () => {
    // Realistischer Extremfall der 0-3-Skala: erfahrene (3) vs. Anfänger (1).
    // Abstand 2, Jitter ±1 -> Wertebereiche [2,4) und [0,2) überlappen nie.
    const players = makePlayers([3, 3, 3, 3, 1, 1, 1]);
    const sizes = computeTableSizes(players.length);

    for (let i = 0; i < 50; i++) {
      const tables = assignSkillBalancedCasualRound(players, sizes);
      const fourTable = tables.find((t) => t.length === 4)!;
      expect(new Set(fourTable)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
    }
  });

  it("wirft PairingError bei nicht passender Tischgrößen-Summe", () => {
    const players = makePlayers([1, 2, 3]);
    expect(() => assignSkillBalancedCasualRound(players, [4])).toThrow(
      PairingError,
    );
  });
});
