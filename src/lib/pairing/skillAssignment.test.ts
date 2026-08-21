import { describe, expect, it } from "vitest";
import { assignSkillBalancedCasualRound, type SkillRatedPlayer } from "./skillAssignment";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";
import type { PlayerGroup } from "./groups";

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

  it("hält eine Gruppe zusammen und bewertet sie nach Durchschnitts-Skill", () => {
    // N=11 -> [4,4,3]. Gruppe aus einem starken (3) und einem schwachen (1)
    // Spieler -> Durchschnitt 2, landet also nicht zwingend beim reinen
    // Stärksten-Tisch, aber immer zusammen an einem Tisch.
    const players: SkillRatedPlayer[] = [
      { id: "strong1", skillLevel: 3 },
      { id: "strong2", skillLevel: 3 },
      { id: "weak1", skillLevel: 1 },
      { id: "weak2", skillLevel: 1 },
      { id: "weak3", skillLevel: 1 },
      { id: "g-strong", skillLevel: 3 },
      { id: "g-weak", skillLevel: 1 },
      { id: "n1", skillLevel: 2 },
      { id: "n2", skillLevel: 2 },
      { id: "n3", skillLevel: 2 },
      { id: "n4", skillLevel: 2 },
    ];
    const groups: PlayerGroup[] = [
      { id: "g1", playerIds: ["g-strong", "g-weak"] },
    ];
    const sizes = computeTableSizes(players.length);

    for (let i = 0; i < 30; i++) {
      const tables = assignSkillBalancedCasualRound(players, sizes, 0, groups);
      const tableWithGroup = tables.find((t) => t.includes("g-strong"))!;
      expect(tableWithGroup).toContain("g-weak");
      expect(tables.flat().length).toBe(players.length);
      expect(new Set(tables.flat()).size).toBe(players.length);
    }
  });

  it("hält eine Vierer-Gruppe zusammen und respektiert die Tischgrößen", () => {
    const players = makePlayers([3, 3, 1, 1, 2, 2, 2]); // N=7 -> [4,3]
    const groups: PlayerGroup[] = [
      { id: "g1", playerIds: ["p0", "p1", "p2", "p3"] },
    ];
    const sizes = computeTableSizes(players.length);
    const tables = assignSkillBalancedCasualRound(players, sizes, 0, groups);

    const tableWithGroup = tables.find((t) => t.includes("p0"))!;
    expect(new Set(tableWithGroup)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
    expect(tables.map((t) => t.length).sort()).toEqual([...sizes].sort());
  });

  it("wirft PairingError, wenn eine Gruppe nicht in die Tischgrößen passt", () => {
    const players = makePlayers([1, 1, 1, 1, 1, 1]); // N=6 -> [3,3]
    const groups: PlayerGroup[] = [
      { id: "g1", playerIds: ["p0", "p1", "p2", "p3"] },
    ];
    const sizes = computeTableSizes(players.length);
    expect(() =>
      assignSkillBalancedCasualRound(players, sizes, 0, groups),
    ).toThrow(PairingError);
  });
});
