import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCasualPairing } from "@/lib/casualPairing";
import { loadPublicNames } from "@/lib/publicRoster";
import type { CATEGORIES, SCOPE_LABELS } from "@/lib/achievements";

export interface PublicAchievement {
  id: string;
  title: string;
  description: string;
  points: number;
  scope: keyof typeof SCOPE_LABELS;
  category: (typeof CATEGORIES)[number];
}

export interface PublicTable {
  key: string;
  tableNumber: number;
  players: { key: string; name: string }[];
}

export interface PublicPairings {
  /** Liga: die Nummer des gezeigten Matches. Casual: null. */
  matchNumber: number | null;
  tables: PublicTable[];
  achievements: PublicAchievement[];
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
      achievements: [],
    };
  }

  const evening = await prisma.evening.findFirst({
    where: { finishedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      achievements: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          points: true,
          scope: true,
          category: true,
        },
      },
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
    // Die geltenden Achievements des laufenden Liga-Abends, damit die
    // Spieler sie am Tisch nachschlagen können (SPEC.md Abschnitt 11).
    achievements: evening?.achievements ?? [],
  };
}

/**
 * Fingerabdruck dessen, was die Pairing-Seite zeigt. Ändert sich etwas
 * Sichtbares (live schalten, tauschen, neues Match, Zurücksetzen), ändert
 * sich auch er — die offene Seite lädt dann neu, sonst nicht.
 */
export function pairingsVersion(pairings: PublicPairings): string {
  return createHash("sha256").update(JSON.stringify(pairings)).digest("hex").slice(0, 16);
}
