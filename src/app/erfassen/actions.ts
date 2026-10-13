"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { applyMark, getDeviceEntry } from "@/lib/entries";

/**
 * Die Erfassung dieses Geräts, solange der Spieler noch ändern darf: bis
 * der Organisator die Erfassung schliesst — auch nach «Abgeben», das nur
 * noch «ich bin fertig» heisst (SPEC.md Abschnitt 12.2).
 */
async function editableEntry() {
  const entry = await getDeviceEntry();
  if (!entry || entry.evening.entryClosedAt) return null;
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
  if (ok) revalidatePath("/admin/ligaverwaltung");
  return ok;
}

/** «Abgeben»: der Spieler ist fertig. Ändern kann er bis zum Schliessen weiterhin. */
export async function submitMine() {
  const entry = await editableEntry();
  if (entry && !entry.submittedAt) {
    await prisma.playerEntry.update({
      where: { id: entry.id },
      data: { submittedAt: new Date() },
    });
    revalidatePath("/admin/ligaverwaltung");
  }
  redirect("/erfassen");
}
