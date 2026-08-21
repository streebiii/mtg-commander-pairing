import { SKILL_LEVEL_MAX } from "@/lib/players";
import { groupByValueWithJitter } from "./rankGrouping";
import { shuffle } from "./shuffle";
import { PairingError } from "./errors";
import { averageValue, packGroupsIntoTables, type PlayerGroup } from "./groups";

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
 * erscheinen (siehe SPEC.md Abschnitt 4.2).
 *
 * Keine Rematch-Vermeidung nötig: Modus A ist immer eine Einzelrunde ohne
 * Verlauf (siehe SPEC.md Abschnitt 4).
 *
 * Gruppen (siehe SPEC.md Abschnitt 4.1 bzw. Grill-Notizen) zählen dabei
 * als eine Einheit mit dem Durchschnitts-Skill ihrer Mitglieder: dieser
 * Wert bestimmt, in welche Stärke-Region der Tische die Gruppe als Ganzes
 * einsortiert wird. Die Gruppe verankert damit eine Rang-Region; die
 * übrigen Einzelspieler füllen die restlichen Plätze weiterhin nach
 * absteigendem Skill auf. Tischgrößen (Abschnitt 3) bleiben unangetastet,
 * Gruppenmitglieder landen garantiert am selben Tisch.
 *
 * @param players Anwesende Spieler mit ihrer Skill-Einstufung.
 * @param tableSizes Tischgrößen gemäß computeTableSizes.
 * @param jitterAmount Override für SKILL_JITTER (v.a. für Tests).
 * @param groups Optionale Gruppen, die zusammen sitzen sollen.
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignSkillBalancedCasualRound(
  players: readonly SkillRatedPlayer[],
  tableSizes: readonly number[],
  jitterAmount: number = SKILL_JITTER,
  groups: readonly PlayerGroup[] = [],
): string[][] {
  const resolvedSkillById = new Map(
    players.map((p) => [
      p.id,
      p.skillLevel > 0 ? p.skillLevel : randomSkillLevel(),
    ]),
  );

  if (groups.length === 0) {
    const entities = players.map((p) => ({
      id: p.id,
      value: resolvedSkillById.get(p.id)!,
    }));
    return groupByValueWithJitter(entities, tableSizes, jitterAmount);
  }

  const orderedSizes = [...tableSizes].sort((a, b) => b - a);
  const groupSizeEntries = groups.map((g) => ({
    id: g.id,
    size: g.playerIds.length,
  }));
  const packing = packGroupsIntoTables(groupSizeEntries, orderedSizes);
  if (!packing) {
    throw new PairingError(
      "Die Gruppen passen nicht in die berechneten Tischgrößen",
    );
  }

  const groupById = new Map(groups.map((g) => [g.id, g.playerIds]));
  const groupValue = new Map(
    groups.map((g) => [
      g.id,
      averageValue(g.playerIds.map((id) => resolvedSkillById.get(id)!)),
    ]),
  );

  // Tische ohne Gruppe haben keinen verankerten Rang-Wert (null) — sie
  // werden nach den verankerten Tischen mit den verbleibenden
  // Einzelspielern aufgefüllt.
  const tableTargets = packing.tableGroups.map((groupIds) =>
    groupIds.length === 0
      ? null
      : averageValue(groupIds.map((gid) => groupValue.get(gid)!)),
  );
  const tableOrder = orderedSizes
    .map((_, i) => i)
    .sort((a, b) => {
      const ta = tableTargets[a];
      const tb = tableTargets[b];
      if (ta === null && tb === null) return a - b;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    });

  const groupedPlayerIds = new Set(groups.flatMap((g) => g.playerIds));
  const singleEntities = players
    .filter((p) => !groupedPlayerIds.has(p.id))
    .map((p) => ({ id: p.id, value: resolvedSkillById.get(p.id)! }));
  const jitterOf = new Map(
    singleEntities.map((e) => [e.id, (Math.random() * 2 - 1) * jitterAmount]),
  );
  const sortedSingles = shuffle(singleEntities).sort(
    (a, b) =>
      b.value + jitterOf.get(b.id)! - (a.value + jitterOf.get(a.id)!),
  );

  const tables: string[][] = orderedSizes.map(() => []);
  let singleCursor = 0;
  for (const i of tableOrder) {
    const size = orderedSizes[i];
    const seated = packing.tableGroups[i].flatMap((gid) =>
      shuffle(groupById.get(gid)!),
    );
    const fillerCount = size - seated.length;
    const fillers = sortedSingles
      .slice(singleCursor, singleCursor + fillerCount)
      .map((e) => e.id);
    singleCursor += fillerCount;
    tables[i] = [...seated, ...fillers];
  }
  return tables;
}
