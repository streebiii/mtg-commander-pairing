import { fingerprint } from "@/lib/fingerprint";
import { prisma } from "@/lib/prisma";
import { getCasualPairing } from "@/lib/casualPairing";
import { loadPublicNames } from "@/lib/publicRoster";

export interface PublicTable {
  key: string;
  tableNumber: number;
  players: { key: string; name: string }[];
}

export interface PublicPairings {
  /** Liga: die Nummer des gezeigten Matches. Casual: null. */
  matchNumber: number | null;
  tables: PublicTable[];
}

/**
 * Was die öffentliche Pairing-Seite zeigt (SPEC.md Abschnitt 4.3): eine
 * live geschaltete Casual-Zuteilung, sonst das neueste live geschaltete
 * Match des laufenden Liga-Abends. Öffentlich nur Vorname und Initial
 * (siehe publicNames). Spieler-Stufen tauchen hier nie auf.
 */
export async function loadPublicPairings(): Promise<PublicPairings> {
  const [casual, names] = await Promise.all([getCasualPairing(), loadPublicNames()]);
  if (casual?.published && casual.tables.length > 0) {
    return {
      matchNumber: null,
      tables: casual.tables.map((t) => ({
        key: `casual-${t.tableNumber}`,
        tableNumber: t.tableNumber,
        players: t.players.map((p) => ({ key: p.id, name: names.get(p.id) ?? p.name })),
      })),
    };
  }

  const evening = await prisma.evening.findFirst({
    where: { finishedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      rounds: {
        // Nur veröffentlichte Matches — eine gerade im Warteraum geprüfte
        // Zuteilung ist bewusst noch nicht öffentlich sichtbar. Solange das
        // neueste Match noch nicht live ist, bleibt das vorherige stehen.
        where: { publishedAt: { not: null } },
        orderBy: { number: "desc" },
        take: 1,
        include: {
          tables: {
            orderBy: { tableNumber: "asc" },
            include: {
              assignments: {
                include: { player: true },
                orderBy: [
                  { player: { firstName: "asc" } },
                  { player: { lastName: "asc" } },
                ],
              },
            },
          },
        },
      },
    },
  });

  const round = evening?.rounds[0];
  return {
    matchNumber: round?.number ?? null,
    tables:
      round?.tables.map((t) => ({
        key: t.id,
        tableNumber: t.tableNumber,
        players: t.assignments.map((a) => ({
          key: a.id,
          name: names.get(a.playerId) ?? a.player.firstName,
        })),
      })) ?? [],
  };
}

/**
 * Fingerabdruck dessen, was die Pairing-Seite zeigt. Ändert sich etwas
 * Sichtbares (live schalten, tauschen, neues Match, Zurücksetzen), ändert
 * sich auch er — die offene Seite lädt dann neu, sonst nicht.
 */
export function pairingsVersion(pairings: PublicPairings): string {
  return fingerprint(pairings);
}
