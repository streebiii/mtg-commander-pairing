"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ENTRY_COOKIE_NAME,
  ENTRY_COOKIE_OPTIONS,
  getDeviceEntry,
  hashToken,
  newDeviceToken,
} from "@/lib/entries";

/**
 * Meldet dieses Handy für das Punkteblatt mit diesem Code an (SPEC.md
 * Abschnitt 12.1) und den Spieler als anwesend. Hält schon ein anderes
 * Handy das Blatt, bleibt es gesperrt, bis der Organisator es freigibt;
 * ein Handy hält höchstens ein Blatt pro Abend.
 */
export async function claimSheet(code: string) {
  const back = (fehler: string) =>
    redirect(`/blatt/${encodeURIComponent(code)}?fehler=${fehler}`);

  const entry = await prisma.playerEntry.findUnique({
    where: { sheetCode: code },
    include: { evening: true },
  });
  if (!entry || entry.evening.entryClosedAt) back("ungueltig");

  const device = await getDeviceEntry();
  if (device && device.eveningId === entry!.eveningId) {
    if (device.id === entry!.id) redirect("/erfassen");
    back("handy-belegt");
  }

  // Atomar über die Bedingung «noch ohne Handy»: scannen zwei Handys
  // gleichzeitig dasselbe Blatt, gewinnt genau eines.
  const token = newDeviceToken();
  const now = new Date();
  const { count } = await prisma.playerEntry.updateMany({
    where: { id: entry!.id, deviceTokenHash: null },
    data: {
      deviceTokenHash: hashToken(token),
      claimedAt: now,
      checkedInAt: entry!.checkedInAt ?? now,
    },
  });
  if (count !== 1) back("blatt-belegt");

  (await cookies()).set(ENTRY_COOKIE_NAME, `${entry!.id}.${token}`, ENTRY_COOKIE_OPTIONS);
  revalidatePath("/admin/league");
  revalidatePath("/admin/ligaverwaltung");
  redirect("/erfassen");
}
