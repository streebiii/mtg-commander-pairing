import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";

/**
 * Die aktuelle Casual-Tischzuteilung (siehe SPEC.md Abschnitt 4).
 *
 * Es existiert immer nur genau eine: Speichern ersetzt die vorherige
 * vollständig, Zurücksetzen löscht sie. Das ist bewusst kein Verlauf —
 * Casual-Zuteilungen sind flüchtig, zählen nicht als Abend-Teilnahme und
 * blockieren deshalb auch nie das Löschen eines Spielers (Abschnitt 6.2).
 *
 * Gespeichert wird ausschliesslich, damit die öffentliche Lese-Ansicht die
 * Tische zeigen kann.
 */
export interface CasualPairingTable {
  tableNumber: number;
  players: { id: string; name: string }[];
}

/** Ersetzt die gespeicherte Zuteilung vollständig durch die übergebene. */
export async function saveCasualPairing(
  tables: readonly { tableNumber: number; playerIds: readonly string[] }[],
): Promise<void> {
  const seats = tables.flatMap((t) =>
    t.playerIds.map((playerId) => ({ tableNumber: t.tableNumber, playerId })),
  );

  // In einer Transaktion, damit nie ein halb ersetzter Zwischenstand
  // öffentlich sichtbar wird.
  await prisma.$transaction([
    prisma.casualSeat.deleteMany({}),
    prisma.casualSeat.createMany({ data: seats }),
  ]);
}

/** Verwirft die aktuelle Zuteilung — danach ist die öffentliche Seite leer. */
export async function clearCasualPairing(): Promise<void> {
  await prisma.casualSeat.deleteMany({});
}

/** Liest die aktuelle Zuteilung, nach Tischnummer gruppiert. */
export async function getCasualPairing(): Promise<CasualPairingTable[]> {
  const seats = await prisma.casualSeat.findMany({
    orderBy: [{ tableNumber: "asc" }],
    include: { player: true },
  });
  if (seats.length === 0) return [];

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
  return tables;
}
