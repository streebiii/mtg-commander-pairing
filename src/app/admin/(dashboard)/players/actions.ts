"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseSkillLevel } from "@/lib/players";

/** Beide Tabs zeigen Spielerdaten — nach Änderungen immer beide auffrischen. */
function revalidatePlayerViews() {
  revalidatePath("/admin/players");
  revalidatePath("/admin/league");
  revalidatePath("/admin/casual");
}

export async function createPlayer(formData: FormData) {
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

export async function updatePlayer(formData: FormData) {
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
