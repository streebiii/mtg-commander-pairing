import { groupByValueWithJitter } from "./rankGrouping";

/**
 * Zufalls-Rauschen (in Skill-Stufen) für die Sortierung beim
 * skill-balancierten Modus A. Kleiner als der Liga-Jitter, da die
 * Skill-Skala nur 0-5 statt eines offenen Punktebereichs umfasst.
 */
export const SKILL_JITTER = 1;

export interface SkillRatedPlayer {
  id: string;
  /** 0 = unbekannt/nicht eingestuft, 1-5 = Skill-Einstufung. */
  skillLevel: number;
}

/**
 * Weist Spieler den Tischen einer skill-balancierten Modus-A-Runde zu.
 *
 * Nutzt denselben Rang-Gruppierungs-Mechanismus wie Modus B (siehe
 * SPEC.md Abschnitt 5.1), nur mit Skill-Level statt Liga-Punkten als
 * Sortier-Kriterium. Unbewertete Spieler (skillLevel = 0) werden dabei so
 * behandelt, als hätten sie den Mittelwert der bewerteten Spieler (bzw.
 * 2.5, falls niemand bewertet ist) — sie landen tendenziell in der Mitte
 * statt automatisch am schwächsten Tisch (siehe SPEC.md Abschnitt 4.1).
 *
 * Keine Rematch-Vermeidung nötig: Modus A ist immer eine Einzelrunde ohne
 * Verlauf (siehe SPEC.md Abschnitt 4).
 *
 * @param players Anwesende Spieler mit ihrer Skill-Einstufung.
 * @param tableSizes Tischgrößen gemäß computeTableSizes.
 * @param jitterAmount Override für SKILL_JITTER (v.a. für Tests).
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignSkillBalancedCasualRound(
  players: readonly SkillRatedPlayer[],
  tableSizes: readonly number[],
  jitterAmount: number = SKILL_JITTER,
): string[][] {
  const rated = players.filter((p) => p.skillLevel > 0);
  const meanSkill =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + p.skillLevel, 0) / rated.length
      : 2.5;

  const entities = players.map((p) => ({
    id: p.id,
    value: p.skillLevel > 0 ? p.skillLevel : meanSkill,
  }));

  return groupByValueWithJitter(entities, tableSizes, jitterAmount);
}
