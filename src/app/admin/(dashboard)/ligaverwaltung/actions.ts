"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";
import { applyMark, gamesPlayed, seasonRoundError } from "@/lib/entries";
import { isLastEvening } from "@/lib/season";

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
 * Bestätigung und nach dem Schliessen.
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

/**
 * Gibt einem Liga-Teilnehmenden, der am letzten Abend der Saison nicht
 * gespielt hat, Evergreen — oder nimmt es wieder weg (SPEC.md Abschnitt
 * 13.1). Wer gespielt hat, bekommt es über «Korrigieren».
 */
export async function setAbsentEvergreen(
  eveningId: string,
  playerId: string,
  on: boolean,
): Promise<boolean> {
  await requireAdmin();
  const evening = await prisma.evening.findUnique({
    where: { id: eveningId },
    include: { achievements: { where: { scope: "SEASON" }, orderBy: { sortOrder: "asc" } } },
  });
  const evergreen = evening?.achievements[0];
  if (!evening || !evergreen || !isLastEvening(evening.date)) return false;
  if ((await gamesPlayed(eveningId, playerId)).length > 0) return false;

  const entry = await prisma.playerEntry.upsert({
    where: { eveningId_playerId: { eveningId, playerId } },
    create: { eveningId, playerId },
    update: {},
  });
  const ok = await applyMark(entry, evergreen.id, 0, on ? 1 : 0);
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

/** Bestätigt eine Erfassung, z.B. nach dem Abtippen eines Zettels. */
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
 * Jede Spalte gehört höchstens einem Abend der Saison (seasonRoundError).
 */
export async function closeEntry(
  eveningId: string,
  seasonRound: number | null,
): Promise<{ error: string } | undefined> {
  await requireAdmin();
  const error = await seasonRoundError(eveningId, seasonRound);
  if (error) return { error };

  await prisma.evening.update({
    where: { id: eveningId },
    data: { entryClosedAt: new Date(), seasonRound },
  });
  revalidateEntryViews();
  revalidatePath("/rangliste");
}

/** Gibt die zurückgehaltene Endrangliste frei (SPEC.md Abschnitt 13.5). */
export async function publishRanking(eveningId: string) {
  await requireAdmin();
  await prisma.evening.updateMany({
    where: { id: eveningId, entryClosedAt: { not: null }, rankingPublishedAt: null },
    data: { rankingPublishedAt: new Date() },
  });
  revalidateEntryViews();
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
