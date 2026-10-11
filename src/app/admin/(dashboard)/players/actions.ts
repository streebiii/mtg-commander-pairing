"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import {
  formatPlayerName,
  parseSkillLevel,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "@/lib/players";

/** Beide Tabs zeigen Spielerdaten — nach Änderungen immer beide auffrischen. */
function revalidatePlayerViews() {
  revalidatePath("/admin/players");
  revalidatePath("/admin/league");
  revalidatePath("/admin/casual");
}

export async function createPlayer(formData: FormData) {
  await requireAdmin();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const skillLevel = parseSkillLevel(formData.get("skillLevel"));
  const leagueActive = formData.get("leagueActive") === "on";

  if (!firstName) return;
  if (skillLevel === null) return;

  // points bewusst nicht gesetzt — neue Spieler starten gemäss Schema-Default
  // bei 0 und werden im Liga-Tab gepflegt (siehe SPEC.md Abschnitt 6).
  await prisma.player.create({
    data: { firstName, lastName: lastName || null, skillLevel, leagueActive },
  });
  revalidatePlayerViews();
}

/**
 * Legt aus der Casual-Spielerauswahl heraus einen Spieler an, wenn jemand
 * auftaucht, der noch nicht erfasst ist. Gibt ihn zurück, damit er gleich
 * ausgewählt werden kann. Nicht Liga-teilnehmend, Punkte 0.
 */
export async function quickCreatePlayer(input: {
  firstName: unknown;
  lastName: unknown;
  skillLevel: unknown;
}): Promise<{ player: { id: string; name: string } } | { error: string }> {
  await requireAdmin();
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const skillLevel = parseSkillLevel(input.skillLevel ?? 0);
  if (!firstName) return { error: "Vorname fehlt" };
  if (skillLevel === null) {
    return { error: `Stufe muss zwischen ${SKILL_LEVEL_MIN} und ${SKILL_LEVEL_MAX} liegen` };
  }

  const player = await prisma.player.create({
    data: { firstName, lastName: lastName || null, skillLevel },
  });
  revalidatePlayerViews();
  return { player: { id: player.id, name: formatPlayerName(player) } };
}

export async function updatePlayer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const skillLevel = parseSkillLevel(formData.get("skillLevel"));
  const leagueActive = formData.get("leagueActive") === "true";

  if (!id || !firstName) return;
  if (skillLevel === null) return;

  await prisma.player.update({
    where: { id },
    data: { firstName, lastName: lastName || null, skillLevel, leagueActive },
  });
  revalidatePlayerViews();
}

/**
 * Entfernt einen Spieler aus der Oberfläche (siehe SPEC.md Abschnitt 6):
 *
 * - ohne Abend-Historie: echtes Löschen aus der Datenbank.
 * - mit Historie: archivieren statt löschen, damit vergangene Abende und
 *   deren Ergebnisse nachvollziehbar bleiben (Abschnitt 8). Der Spieler
 *   verschwindet dabei aus allen Listen.
 * - während er an einem laufenden Liga-Abend zugeteilt ist: gar nicht,
 *   sonst zerreisst es die Tische des laufenden Abends.
 */
export async function deletePlayer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inRunningEvening = await prisma.tableAssignment.count({
    where: {
      playerId: id,
      table: { round: { evening: { finishedAt: null } } },
    },
  });
  if (inRunningEvening > 0) return;

  const assignmentCount = await prisma.tableAssignment.count({
    where: { playerId: id },
  });

  if (assignmentCount === 0) {
    await prisma.player.delete({ where: { id } });
  } else {
    await prisma.player.update({
      where: { id },
      data: { archivedAt: new Date(), leagueActive: false },
    });
  }
  revalidatePlayerViews();
}
