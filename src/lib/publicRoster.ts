import { prisma } from "@/lib/prisma";
import { publicNames } from "@/lib/players";

/**
 * Öffentliche Namen aller Spieler nach ID (Vorname und so viel vom
 * Nachnamen wie nötig, siehe `publicNames`). Unterschieden wird gegen alle
 * Spieler, auch archivierte — sie können in alten Runden noch vorkommen,
 * und so heisst jeder überall gleich.
 */
export async function loadPublicNames(): Promise<Map<string, string>> {
  return publicNames(
    await prisma.player.findMany({ select: { id: true, firstName: true, lastName: true } }),
  );
}
