"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { applyMark } from "@/lib/entries";
import { EVENINGS_PER_SEASON, isInSeason } from "@/lib/season";

// Organisator-Aktionen der Achievement-Erfassung (siehe SPEC.md Abschnitt
// 12). Jede Action prüft die Anmeldung selbst (siehe requireAdmin) —
// der Proxy allein schützt Server Actions nicht.

function revalidateEntryViews() {
  revalidatePath("/admin/ligaverwaltung", "layout");
  revalidatePath("/admin/players", "layout");
  revalidatePath("/admin/league");
  revalidatePath("/erfassen");
  // Korrekturen an geschlossenen Abenden wirken sofort auf die Rangliste.
  revalidatePath("/rangliste");
  revalidatePath("/admin");
}

/**
 * Erfasst für einen Spieler — z.B. von seinem Papierzettel. Legt die
 * Erfassung bei Bedarf an; ändern darf der Organisator auch nach der
 * Abgabe und nach dem Schliessen.
 */
export async function setMarkAsOrganizer(
  eveningId: string,
  playerId: string,
  eveningAchievementId: string,
  game: number,
  count: number,
): Promise<boolean> {
  await requireAdmin();
  const entry = await prisma.playerEntry.upsert({
    where: { eveningId_playerId: { eveningId, playerId } },
    create: { eveningId, playerId },
    update: {},
  });
  const ok = await applyMark(entry, eveningAchievementId, game, count);
  if (ok) revalidateEntryViews();
  return ok;
}

/** Löst die Bindung an ein Handy, z.B. nach einem Handywechsel. */
export async function releaseDevice(entryId: string) {
  await requireAdmin();
  await prisma.playerEntry.update({
    where: { id: entryId },
    data: { deviceTokenHash: null, claimedAt: null },
  });
  revalidateEntryViews();
}

/** Bestätigt eine Erfassung als abgegeben, z.B. nach dem Abtippen eines Zettels. */
export async function confirmEntry(eveningId: string, playerId: string) {
  await requireAdmin();
  await prisma.playerEntry.upsert({
    where: { eveningId_playerId: { eveningId, playerId } },
    create: { eveningId, playerId, submittedAt: new Date() },
    update: { submittedAt: new Date() },
  });
  revalidateEntryViews();
}

/**
 * Schliesst die Erfassung des Abends. Danach können die Spieler nichts
 * mehr ändern, und der Abend zählt in der Rangliste — in der Spalte
 * `seasonRound` (R1–R6). null heisst Testabend: er zählt nicht.
 *
 * Jede Spalte gehört höchstens einem Abend der Saison; sonst wäre nicht
 * klar, welcher gilt.
 */
export async function closeEntry(
  eveningId: string,
  seasonRound: number | null,
): Promise<{ error: string } | undefined> {
  await requireAdmin();
  if (
    seasonRound !== null &&
    (!Number.isInteger(seasonRound) || seasonRound < 1 || seasonRound > EVENINGS_PER_SEASON)
  ) {
    return { error: "Ungültige Spalte" };
  }

  if (seasonRound !== null) {
    const taken = await prisma.evening.findMany({
      where: { id: { not: eveningId }, seasonRound },
      select: { date: true },
    });
    const conflict = taken.find((e) => isInSeason(e.date));
    if (conflict) {
      const day = conflict.date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
      return { error: `R${seasonRound} ist schon der Runde vom ${day} zugeordnet.` };
    }
  }

  await prisma.evening.update({
    where: { id: eveningId },
    data: { entryClosedAt: new Date(), seasonRound },
  });
  revalidateEntryViews();
  revalidatePath("/rangliste");
}

/**
 * Löscht eine Runde endgültig, mit allem, was daran hängt (Matches,
 * Tische, Erfassungen, Nachzügler; per Cascade) — auch eine gezählte oder
 * laufende (SPEC.md Abschnitt 14). Die Rückfrage im Browser nennt, was
 * dabei verloren geht.
 */
export async function deleteRound(eveningId: string) {
  await requireAdmin();
  await prisma.evening.deleteMany({ where: { id: eveningId } });
  revalidateEntryViews();
  revalidatePath("/");
}
