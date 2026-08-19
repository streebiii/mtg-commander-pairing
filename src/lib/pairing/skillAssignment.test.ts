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

  it("behandelt unbewertete Spieler (0) als Mittelwert der bewerteten, nicht als schwächste Stufe", () => {
    // 3 stark bewertete (5), 3 unbewertete (0) -> Mittelwert der bewerteten = 5.
    // Die Unbewerteten sollten also NICHT automatisch am schwächsten Tisch
    // landen (dort gäbe es sonst gar keine anderen Spieler zum Vergleich),
    // sondern gemäß des imputierten Werts (5) mit den Bewerteten gemischt
    // werden können. Wir prüfen das gegen die Alternative (0 als Literalwert
    // gewertet), bei der die Unbewerteten IMMER strikt unten landen würden.
    const players: SkillRatedPlayer[] = [
      { id: "a1", skillLevel: 5 },
      { id: "a2", skillLevel: 5 },
      { id: "a3", skillLevel: 5 },
      { id: "u1", skillLevel: 0 },
      { id: "u2", skillLevel: 0 },
      { id: "u3", skillLevel: 0 },
    ];
    const sizes = computeTableSizes(players.length); // [3,3]

    // Über viele Läufe sollte der Tisch mit a1 nicht IMMER exakt {a1,a2,a3}
    // sein (das wäre der Fall, wenn 0 buchstäblich als schwächste Stufe
    // gewertet würde und nie mit den 5ern gemischt werden könnte).
    let mixedAtLeastOnce = false;
    for (let i = 0; i < 50; i++) {
      const tables = assignSkillBalancedCasualRound(players, sizes);
      const tableWithA1 = tables.find((t) => t.includes("a1"))!;
      if (!["a1", "a2", "a3"].every((id) => tableWithA1.includes(id))) {
        mixedAtLeastOnce = true;
        break;
      }
    }
    expect(mixedAtLeastOnce).toBe(true);
  });

  it("nutzt 2.5 als Mittelwert, wenn kein einziger Spieler bewertet ist", () => {
    // Alle unbewertet -> alle bekommen denselben Wert (2.5) -> rein zufällige
    // Gruppierung. Der Test prüft nur, dass es nicht crasht und alle Spieler
    // korrekt verteilt werden.
    const players = makePlayers([0, 0, 0, 0, 0, 0, 0]);
    const sizes = computeTableSizes(players.length);
    const tables = assignSkillBalancedCasualRound(players, sizes);

    expect(tables.flat().length).toBe(7);
    expect(new Set(tables.flat()).size).toBe(7);
  });

  it("mischt bei großem Skill-Abstand nie über die Tischgrenze hinweg", () => {
    const players = makePlayers([5, 5, 5, 5, 1, 1, 1]); // Abstand 4, Jitter ±1
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
