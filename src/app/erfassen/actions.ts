"use server";

import { revalidatePath } from "next/cache";
import { applyPlayerMark, confirmPlayerStep, getDeviceEntry } from "@/lib/entries";

/**
 * Die Erfassung dieses Geräts, solange der Spieler noch eintragen darf:
 * bis der Organisator die Erfassung schliesst. Was er schon bestätigt
 * hat, sperrt `applyPlayerMark` einzeln (SPEC.md Abschnitt 12.2).
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
  const ok = await applyPlayerMark(entry, eveningAchievementId, game, count);
  if (ok) {
    revalidatePath("/admin/ligaverwaltung");
    // «Winner winner» kann das Tisch-Ergebnis setzen.
    revalidatePath("/admin/league");
  }
  return ok;
}

/** «Korrekt? — Ja» für den Deckbau (0) oder ein Spiel. */
export async function confirmMyStep(step: number): Promise<boolean> {
  if (!Number.isInteger(step) || step < 0 || step > 2) return false;
  const entry = await editableEntry();
  if (!entry) return false;
  const ok = await confirmPlayerStep(entry, step);
  if (ok) {
    revalidatePath("/erfassen");
    revalidatePath("/admin/ligaverwaltung");
    revalidatePath("/admin/league");
  }
  return ok;
}
