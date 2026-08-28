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
 * Gespeichert wird in erster Linie, damit die öffentliche Lese-Ansicht die
 * Tische zeigen kann; die Admin-Seite liest denselben Stand beim Laden als
 * Startzustand (siehe `getRecentCasualPairing()`).
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

/**
 * Frist, innerhalb derer die Admin-Seite eine gespeicherte Zuteilung beim
 * Laden automatisch wieder anzeigt (siehe BACKLOG.md "Casual-Zuteilung
 * überlebt Reload der Admin-Seite"). Ein Spielabend dauert nie länger als
 * das; was älter ist, gehört zu einem vergangenen Abend und soll dem
 * Organisator nicht als aktueller Stand untergeschoben werden.
 */
export const CASUAL_PAIRING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Wie `getCasualPairing()`, liefert aber nur Zuteilungen zurück, die
 * jünger als `CASUAL_PAIRING_MAX_AGE_MS` sind — sonst eine leere Liste.
 *
 * Betrifft ausschliesslich die Auto-Anzeige im Admin-Bereich: die Zeilen
 * bleiben in der Datenbank stehen und die öffentliche Seite zeigt sie
 * weiterhin unbegrenzt, bis sie zurückgesetzt werden.
 */
export async function getRecentCasualPairing(): Promise<CasualPairingTable[]> {
  // Alle Zeilen einer Zuteilung teilen denselben Zeitstempel
  // (`saveCasualPairing()` legt sie in einer Transaktion per `createMany`
  // an), eine einzelne genügt daher zur Altersbestimmung.
  const oldest = await prisma.casualSeat.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (!oldest) return [];
  if (Date.now() - oldest.createdAt.getTime() > CASUAL_PAIRING_MAX_AGE_MS) return [];
  return getCasualPairing();
}
