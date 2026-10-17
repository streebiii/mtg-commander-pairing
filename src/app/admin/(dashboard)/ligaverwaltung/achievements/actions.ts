"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCOPE,
  ROTATING_DRAW_SIZE,
  parseCategory,
  parseScope,
} from "@/lib/achievements";

/** Der Katalog erscheint im Achievements-Tab und (über Abende) öffentlich. */
function revalidateAchievementViews() {
  revalidatePath("/admin/ligaverwaltung", "layout");
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Formulare übertragen Zeilenumbrüche als CRLF — einheitlich als LF
 * speichern, damit Vergleiche und Anzeige nicht davon abhängen.
 */
function parseText(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function parsePoints(value: FormDataEntryValue | null): number | null {
  const points = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(points) ? points : null;
}

/**
 * Legt ein Achievement an. Gibt die id zurück, bei unvollständigen Angaben
 * null — dann bleibt das Panel offen, statt die Eingaben zu verwerfen.
 */
export async function createAchievement(
  formData: FormData,
): Promise<string | null> {
  await requireAdmin();
  const title = parseText(formData.get("title"));
  const description = parseText(formData.get("description"));
  const points = parsePoints(formData.get("points"));
  const category = parseCategory(formData.get("category"));
  if (!title || points === null || category === null) return null;
  const scope = parseScope(formData.get("scope")) ?? DEFAULT_SCOPE[category];

  // Neue Einträge hinten an ihre Kategorie anhängen.
  const last = await prisma.achievement.findFirst({
    where: { category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.achievement.create({
    data: {
      title,
      description,
      points,
      category,
      scope,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidateAchievementViews();
  return created.id;
}

/**
 * Auto-Save einer Katalogzeile. Wirkt nur auf künftige Abende — ein
 * gestarteter Abend trägt seine eigene Kopie (siehe SPEC.md Abschnitt 11).
 * `active` entscheidet, ob das Achievement am nächsten Liga-Abend gilt.
 */
export async function updateAchievement(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const title = parseText(formData.get("title"));
  const description = parseText(formData.get("description"));
  const points = parsePoints(formData.get("points"));
  const scope = parseScope(formData.get("scope"));
  const active = formData.get("active") === "true";

  if (!id || !title || points === null || scope === null) return;

  await prisma.achievement.update({
    where: { id },
    data: {
      title,
      description,
      points,
      scope,
      active,
    },
  });
  revalidateAchievementViews();
}

/**
 * Übernimmt eine Auslosung der rotierenden Achievements (DrawPanel): die
 * gezogenen werden aktiv, alle übrigen rotierenden inaktiv — in einer
 * Transaktion, damit nie eine halbe Ziehung gilt. Wirkt wie jede
 * Katalogänderung erst auf die nächste Runde.
 */
export async function activateRotatingDraw(ids: string[]): Promise<boolean> {
  await requireAdmin();
  const unique = [...new Set(ids)];
  const pool = await prisma.achievement.count({ where: { category: "ROTATING" } });
  if (unique.length !== Math.min(ROTATING_DRAW_SIZE, pool)) return false;
  const found = await prisma.achievement.count({
    where: { id: { in: unique }, category: "ROTATING" },
  });
  if (found !== unique.length) return false;

  await prisma.$transaction([
    prisma.achievement.updateMany({
      where: { category: "ROTATING", id: { notIn: unique } },
      data: { active: false },
    }),
    prisma.achievement.updateMany({
      where: { id: { in: unique } },
      data: { active: true },
    }),
  ]);
  revalidateAchievementViews();
  return true;
}
