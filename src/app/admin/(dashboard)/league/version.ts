import { fingerprint } from "@/lib/fingerprint";
import { prisma } from "@/lib/prisma";

/**
 * Fingerabdruck des laufenden Liga-Abends: Matches, Tische, Sieger, Drops,
 * Nachzügler und der Stand der Erfassung. Hakt ein Spieler «Winner
 * winner» ab, ändert er sich — der offene Liga-Tab lädt dann neu und zeigt
 * den Sieger (siehe AutoRefresh, lib/winner.ts).
 */
export async function leagueVersion(): Promise<string> {
  const evening = await prisma.evening.findFirst({
    where: { finishedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lateArrivals: { select: { playerId: true }, orderBy: { createdAt: "asc" } },
      rounds: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          publishedAt: true,
          tables: {
            orderBy: { tableNumber: "asc" },
            select: {
              resultEnteredAt: true,
              assignments: {
                orderBy: { id: "asc" },
                select: { playerId: true, isWinner: true, droppedAt: true },
              },
            },
          },
        },
      },
    },
  });
  const submitted = evening
    ? await prisma.playerEntry.count({
        where: { eveningId: evening.id, submittedAt: { not: null } },
      })
    : 0;
  return fingerprint({ evening, submitted });
}
