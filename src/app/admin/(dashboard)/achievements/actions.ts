"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SCOPE,
  eveningCopy,
  parseCategory,
  parseScope,
} from "@/lib/achievements";

/** Katalog und Auswahl erscheinen im Achievements-Tab und öffentlich. */
function revalidateAchievementViews() {
  revalidatePath("/admin/achievements");
  revalidatePath("/");
}

function parsePoints(value: FormDataEntryValue | null): number | null {
  const points = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(points) ? points : null;
}

export async function createAchievement(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = parsePoints(formData.get("points"));
  const category = parseCategory(formData.get("category"));
  const repeatable = formData.get("repeatable") === "on";

  if (!title || points === null || category === null) return;

  // Neue Einträge hinten an ihre Kategorie anhängen.
  const last = await prisma.achievement.findFirst({
    where: { category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.achievement.create({
    data: {
      title,
      description,
      points,
      category,
      scope: DEFAULT_SCOPE[category],
      repeatable,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidateAchievementViews();
}

/**
 * Auto-Save einer Katalogzeile. Wirkt nur auf künftige Abende — laufende
 * und vergangene tragen ihre eigene Kopie (siehe SPEC.md Abschnitt 11).
 * Wer deaktiviert wird, fällt auch aus der Vormerkung für den nächsten
 * Abend, sonst würde er dort unsichtbar weiter mitgezählt.
 */
export async function updateAchievement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = parsePoints(formData.get("points"));
  const scope = parseScope(formData.get("scope"));
  const repeatable = formData.get("repeatable") === "true";
  const active = formData.get("active") === "true";

  if (!id || !title || points === null || scope === null) return;

  await prisma.achievement.update({
    where: { id },
    data: {
      title,
      description,
      points,
      scope,
      repeatable,
      active,
      ...(active ? {} : { nextSelected: false }),
    },
  });
  revalidateAchievementViews();
}

/** Nimmt ein rotierendes Achievement in die Auswahl für den nächsten Abend auf oder heraus. */
export async function setNextSelected(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const selected = formData.get("selected") === "true";
  if (!id) return;

  await prisma.achievement.updateMany({
    where: { id, category: "ROTATING", active: true },
    data: { nextSelected: selected },
  });
  revalidateAchievementViews();
}

/**
 * Ändert die rotierenden Achievements eines bereits gestarteten Abends.
 * Bewusst jederzeit erlaubt, auch nach der Erfassung (siehe BACKLOG.md):
 * eine Erfassung zu einem entfernten Achievement fällt dann weg.
 */
export async function setEveningSelected(formData: FormData) {
  const eveningId = String(formData.get("eveningId") ?? "");
  const achievementId = String(formData.get("achievementId") ?? "");
  const selected = formData.get("selected") === "true";
  if (!eveningId || !achievementId) return;

  if (selected) {
    const achievement = await prisma.achievement.findFirst({
      where: { id: achievementId, category: "ROTATING", active: true },
    });
    if (!achievement) return;
    // skipDuplicates: ein Doppelklick darf keinen Fehler am Unique-Index werfen.
    await prisma.eveningAchievement.createMany({
      data: [eveningCopy(eveningId, achievement)],
      skipDuplicates: true,
    });
  } else {
    await prisma.eveningAchievement.deleteMany({
      where: { eveningId, achievementId, category: "ROTATING" },
    });
  }
  revalidateAchievementViews();
}
