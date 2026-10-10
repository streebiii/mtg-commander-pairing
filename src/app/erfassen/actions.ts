"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { applyMark, getDeviceEntry } from "@/lib/entries";

/** Die Erfassung dieses Geräts, solange der Spieler noch ändern darf. */
async function editableEntry() {
  const entry = await getDeviceEntry();
  if (!entry || entry.submittedAt || entry.evening.entryClosedAt) return null;
  return entry;
}

export async function setMyMark(
  eveningAchievementId: string,
  game: number,
  count: number,
): Promise<boolean> {
  const entry = await editableEntry();
  if (!entry) return false;
  const ok = await applyMark(entry, eveningAchievementId, game, count);
  if (ok) revalidatePath("/admin/erfassung");
  return ok;
}

/** «Abgeben»: danach kann nur noch der Organisator ändern. */
export async function submitMine() {
  const entry = await editableEntry();
  if (entry) {
    await prisma.playerEntry.update({
      where: { id: entry.id },
      data: { submittedAt: new Date() },
    });
    revalidatePath("/admin/erfassung");
  }
  redirect("/erfassen");
}
