import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";

/**
 * Die aktuelle Casual-Tischzuteilung (siehe SPEC.md Abschnitt 4.3).
 *
 * Es existiert immer nur genau eine: Berechnen ersetzt die vorherige
 * vollständig, Zurücksetzen löscht sie. Das ist bewusst kein Verlauf —
 * Casual-Zuteilungen sind flüchtig, zählen nicht als Abend-Teilnahme und
 * blockieren deshalb auch nie das Löschen eines Spielers (Abschnitt 6.2).
 *
 * Wie eine Liga-Runde beginnt sie im Warteraum: öffentlich sichtbar ist
 * sie erst nach «Live schalten» (`publishedAt`).
 */
export interface CasualPairingTable {
  tableNumber: number;
  players: { id: string; name: string }[];
}

export interface CasualPairing {
  tables: CasualPairingTable[];
  published: boolean;
}

/**
 * Ersetzt die gespeicherte Zuteilung vollständig durch die übergebene.
 *
 * @param keepPublished true für Änderungen an einer bestehenden
 *   Zuteilung (Tauschen, Neumischen einzelner Tische): ist sie schon
 *   live, bleibt sie es. false für eine neue Berechnung — die landet
 *   immer erst im Warteraum.
 */
export async function saveCasualPairing(
  tables: readonly { tableNumber: number; playerIds: readonly string[] }[],
  { keepPublished }: { keepPublished: boolean },
): Promise<void> {
  // In einer Transaktion, damit nie ein halb ersetzter Zwischenstand
  // öffentlich sichtbar wird.
  await prisma.$transaction(async (tx) => {
    const current = keepPublished
      ? await tx.casualSeat.findFirst({ select: { publishedAt: true } })
      : null;
    const publishedAt = current?.publishedAt ?? null;
    await tx.casualSeat.deleteMany({});
    await tx.casualSeat.createMany({
      data: tables.flatMap((t) =>
        t.playerIds.map((playerId) => ({
          tableNumber: t.tableNumber,
          playerId,
          publishedAt,
        })),
      ),
    });
  });
}

/** «Live schalten»: ab jetzt zeigt die öffentliche Seite die Zuteilung. */
export async function publishCasualPairing(): Promise<void> {
  await prisma.casualSeat.updateMany({
    where: { publishedAt: null },
    data: { publishedAt: new Date() },
  });
}

/** Verwirft die aktuelle Zuteilung — danach ist die öffentliche Seite leer. */
export async function clearCasualPairing(): Promise<void> {
  await prisma.casualSeat.deleteMany({});
}

/**
 * Frist, nach der eine gespeicherte Zuteilung nicht mehr als aktuell gilt.
 * Ein Spielabend dauert nie länger als das; was älter ist, gehört zu einem
 * vergangenen Abend. Gilt für den Organisator und die öffentliche Seite
 * gleichermassen — sonst hinge öffentlich eine alte Zuteilung, die der
 * Organisator nicht mehr sieht und darum auch nicht zurücksetzen kann.
 */
export const CASUAL_PAIRING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Die aktuelle Zuteilung, nach Tischnummer gruppiert — oder null, wenn
 * keine existiert oder sie älter als `CASUAL_PAIRING_MAX_AGE_MS` ist.
 */
export async function getCasualPairing(): Promise<CasualPairing | null> {
  const seats = await prisma.casualSeat.findMany({
    orderBy: [{ tableNumber: "asc" }],
    include: { player: true },
  });
  if (seats.length === 0) return null;

  // Alle Zeilen einer Zuteilung entstehen in einer Transaktion und teilen
  // Zeitstempel und Veröffentlichung — eine einzelne genügt.
  if (Date.now() - seats[0].createdAt.getTime() > CASUAL_PAIRING_MAX_AGE_MS) {
    return null;
  }

  const byTable = new Map<number, CasualPairingTable>();
  for (const seat of seats) {
    let table = byTable.get(seat.tableNumber);
    if (!table) {
      table = { tableNumber: seat.tableNumber, players: [] };
      byTable.set(seat.tableNumber, table);
    }
    table.players.push({ id: seat.playerId, name: formatPlayerName(seat.player) });
  }

  const tables = [...byTable.values()].sort((a, b) => a.tableNumber - b.tableNumber);
  for (const table of tables) {
    table.players.sort((a, b) => a.name.localeCompare(b.name));
  }
  return { tables, published: seats[0].publishedAt !== null };
}
