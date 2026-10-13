"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { normalizeColorIdentity } from "@/lib/colorIdentity";
import { normalizeDecklistUrl } from "@/lib/decklist";
import {
  formatPlayerName,
  parseSkillLevel,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
} from "@/lib/players";

/** Mehrere Tabs zeigen Spielerdaten — nach Änderungen alle auffrischen. */
function revalidatePlayerViews() {
  revalidatePath("/admin/players", "layout");
  revalidatePath("/admin/league");
  revalidatePath("/admin/casual");
  revalidatePath("/rangliste");
}

/** Legt im Spieler-Tab einen Spieler an (SPEC.md Abschnitt 6). */
export async function createPlayer(input: {
  firstName: unknown;
  lastName: unknown;
  skillLevel: unknown;
  leagueActive: unknown;
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
    data: {
      firstName,
      lastName: lastName || null,
      skillLevel,
      leagueActive: input.leagueActive === true,
    },
  });
  revalidatePlayerViews();
  return { player: { id: player.id, name: formatPlayerName(player) } };
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
  // Farbidentität wie in Spalte F der Rangliste (SPEC.md Abschnitt 13),
  // in WUBRG-Reihenfolge; leer oder ohne erkennbare Farbe entfernt sie.
  const colorIdentity = normalizeColorIdentity(String(formData.get("colorIdentity") ?? ""));
  // Ungültige Adressen (z.B. javascript:) werden nicht gespeichert — die
  // bisherige bleibt dann stehen (siehe normalizeDecklistUrl).
  const decklistUrl = normalizeDecklistUrl(String(formData.get("decklistUrl") ?? ""));

  if (!id || !firstName) return;
  if (skillLevel === null) return;

  await prisma.player.update({
    where: { id },
    data: {
      firstName,
      lastName: lastName || null,
      skillLevel,
      leagueActive,
      colorIdentity,
      ...(decklistUrl === undefined ? {} : { decklistUrl }),
    },
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
export async function deletePlayer(formData: FormData): Promise<void> {
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

  // Historie sind Tischzuteilungen und Achievement-Erfassungen — auch
  // nachgetragene Abende ohne Tische (siehe SPEC.md Abschnitt 13).
  const [assignmentCount, entryCount] = await Promise.all([
    prisma.tableAssignment.count({ where: { playerId: id } }),
    prisma.playerEntry.count({ where: { playerId: id } }),
  ]);

  if (assignmentCount === 0 && entryCount === 0) {
    await prisma.player.delete({ where: { id } });
  } else {
    await prisma.player.update({
      where: { id },
      data: { archivedAt: new Date(), leagueActive: false },
    });
  }
  revalidatePlayerViews();
}
