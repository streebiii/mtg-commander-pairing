"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ENTRY_COOKIE_NAME,
  ENTRY_COOKIE_OPTIONS,
  findOpenEvening,
  getDeviceEntry,
  hashToken,
  newDeviceToken,
} from "@/lib/entries";

/**
 * Meldet dieses Gerät für einen Spieler an (siehe SPEC.md Abschnitt 12).
 * Erlaubt nur Spieler, die in der aktuellen Runde an genau diesem Tisch
 * sitzen. Hält schon ein anderes Gerät den Namen, bleibt er gesperrt, bis
 * der Organisator ihn freigibt; ein Gerät hält höchstens einen Namen pro
 * Abend.
 */
export async function claimPlayer(tableNumber: number, playerId: string) {
  const back = (fehler: string) =>
    redirect(`/tisch/${tableNumber}?fehler=${fehler}`);

  const evening = await findOpenEvening();
  if (!evening) back("kein-abend");

  const round = await prisma.round.findFirst({
    where: { eveningId: evening!.id, publishedAt: { not: null } },
    orderBy: { number: "desc" },
    include: { tables: { where: { tableNumber }, include: { assignments: true } } },
  });
  const atTable = round?.tables[0]?.assignments.some((a) => a.playerId === playerId);
  if (!atTable) back("nicht-am-tisch");

  const device = await getDeviceEntry();
  if (device && device.eveningId === evening!.id) {
    if (device.playerId === playerId) redirect("/erfassen");
    back("geraet-belegt");
  }

  const existing = await prisma.playerEntry.findUnique({
    where: { eveningId_playerId: { eveningId: evening!.id, playerId } },
  });
  if (existing?.deviceTokenHash) back("name-belegt");

  // Atomar: tippen zwei Geräte gleichzeitig denselben Namen an, gewinnt
  // genau eines — beim Anlegen über den Unique-Index, beim Übernehmen
  // einer freigegebenen Erfassung über die Bedingung «noch ohne Gerät».
  const token = newDeviceToken();
  const claim = { deviceTokenHash: hashToken(token), claimedAt: new Date() };
  let entryId: string | null = null;
  if (existing) {
    const { count } = await prisma.playerEntry.updateMany({
      where: { id: existing.id, deviceTokenHash: null },
      data: claim,
    });
    if (count === 1) entryId = existing.id;
  } else {
    try {
      const created = await prisma.playerEntry.create({
        data: { eveningId: evening!.id, playerId, ...claim },
      });
      entryId = created.id;
    } catch {
      entryId = null;
    }
  }
  if (!entryId) back("name-belegt");

  (await cookies()).set(
    ENTRY_COOKIE_NAME,
    `${entryId}.${token}`,
    ENTRY_COOKIE_OPTIONS,
  );
  revalidatePath("/admin/erfassung");
  redirect("/erfassen");
}
