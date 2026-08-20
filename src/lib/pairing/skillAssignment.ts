import { SKILL_LEVEL_MAX } from "@/lib/players";
import { groupByValueWithJitter } from "./rankGrouping";

/**
 * Zufalls-Rauschen (in Skill-Stufen) für die Sortierung beim
 * skill-balancierten Modus A. Die Skill-Skala umfasst nur 0-3
 * (siehe SPEC.md Abschnitt 6), ein Rauschen von ±1 lässt benachbarte
 * Stufen also schon spürbar variieren, ohne z.B. Anfänger und erfahrene
 * Spieler zu mischen.
 */
export const SKILL_JITTER = 1;

export interface SkillRatedPlayer {
  id: string;
  /** 0 = unbekannt/nicht eingestuft, 1-3 = Skill-Einstufung. */
  skillLevel: number;
}

/**
 * Würfelt eine Stufe für einen noch nicht eingestuften Spieler (skillLevel
 * = 0). Bewusst aus dem Bereich der echten Stufen (1..SKILL_LEVEL_MAX) und
 * nicht inklusive 0 — sonst wäre "noch nicht eingestuft" faktisch doch die
 * schwächste Stufe.
 */
function randomSkillLevel(): number {
  return 1 + Math.floor(Math.random() * SKILL_LEVEL_MAX);
}

/**
 * Weist Spieler den Tischen einer skill-balancierten Modus-A-Runde zu.
 *
 * Nutzt denselben Rang-Gruppierungs-Mechanismus wie Modus B (siehe
 * SPEC.md Abschnitt 5.1), nur mit Skill-Level statt Liga-Punkten als
 * Sortier-Kriterium. Für unbewertete Spieler (skillLevel = 0) wird pro
 * Berechnung eine zufällige Stufe gewürfelt — sie können damit an jedem
 * Tisch landen, statt systematisch immer in derselben Region zu
 * erscheinen (siehe SPEC.md Abschnitt 4.1).
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
  const entities = players.map((p) => ({
    id: p.id,
    value: p.skillLevel > 0 ? p.skillLevel : randomSkillLevel(),
  }));

  return groupByValueWithJitter(entities, tableSizes, jitterAmount);
}
