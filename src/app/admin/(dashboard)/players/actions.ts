"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseSkillLevel } from "@/lib/players";

export async function createPlayer(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const pointsRaw = String(formData.get("points") ?? "0").trim();
  const points = Number.parseInt(pointsRaw, 10);
  const skillLevel = parseSkillLevel(formData.get("skillLevel"));

  if (!firstName) return;
  if (!Number.isFinite(points)) return;
  if (skillLevel === null) return;

  await prisma.player.create({
    data: { firstName, lastName: lastName || null, points, skillLevel },
  });
  revalidatePath("/admin/players");
}

export async function updatePlayer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const pointsRaw = String(formData.get("points") ?? "").trim();
  const points = Number.parseInt(pointsRaw, 10);
  const skillLevel = parseSkillLevel(formData.get("skillLevel"));

  if (!id || !firstName || !Number.isFinite(points)) return;
  if (skillLevel === null) return;

  await prisma.player.update({
    where: { id },
    data: { firstName, lastName: lastName || null, points, skillLevel },
  });
  revalidatePath("/admin/players");
}

export async function deletePlayer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Spieler mit bestehenden Tisch-Zuteilungen (Verlauf) nicht löschen, um die
  // Historie vergangener Abende nicht zu beschädigen (siehe SPEC.md
  // Abschnitt 8). Stattdessen müsste der Spieler umbenannt/inaktiv gesetzt
  // werden — das ist bewusst außerhalb des v1-Scopes.
  const assignmentCount = await prisma.tableAssignment.count({
    where: { playerId: id },
  });
  if (assignmentCount > 0) return;

  await prisma.player.delete({ where: { id } });
  revalidatePath("/admin/players");
}
