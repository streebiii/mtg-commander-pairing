import { prisma } from "@/lib/prisma";
import { loadRanking } from "@/lib/rankingData";
import PlayerTable from "./PlayerTable";

// Admin-Seiten lesen immer den aktuellen DB-Stand, kein statisches Caching.
export const dynamic = "force-dynamic";

// Zentrale Vereins-Spielerverwaltung (SPEC.md Abschnitt 6), gebaut wie der
// Achievement-Katalog. Archivierte Spieler erscheinen hier nicht mehr.
export default async function PlayersPage() {
  const [players, ranking] = await Promise.all([
    prisma.player.findMany({
      where: { archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        skillLevel: true,
        leagueActive: true,
        colorIdentity: true,
      },
    }),
    loadRanking(),
  ]);
  const seasonPoints = new Map(ranking.rows.map((r) => [r.id, r.total]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Spieler</h1>
      <PlayerTable
        players={players.map((p) => ({ ...p, seasonPoints: seasonPoints.get(p.id) ?? null }))}
      />
    </div>
  );
}
