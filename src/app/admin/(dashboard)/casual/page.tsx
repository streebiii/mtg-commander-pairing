import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { getRecentCasualPairing } from "@/lib/casualPairing";
import CasualClient from "./CasualClient";
import CasualInfo from "./CasualInfo";

export const dynamic = "force-dynamic";

export default async function CasualPage() {
  const [rawPlayers, pairing] = await Promise.all([
    prisma.player.findMany({
      where: { archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, skillLevel: true },
    }),
    getRecentCasualPairing(),
  ]);
  const players = rawPlayers.map((p) => ({
    id: p.id,
    name: formatPlayerName(p),
    skillLevel: p.skillLevel,
  }));

  // Die zuletzt berechnete Zuteilung liegt ohnehin in der Datenbank —
  // von dort wird sie beim Laden als Startzustand übernommen, damit ein
  // Reload sie nicht mehr verschluckt (siehe BACKLOG.md). `skillLevel`
  // wird in der Tischanzeige nirgends gerendert, ein Platzhalter genügt.
  const initialTables =
    pairing.length > 0
      ? pairing.map((t) => ({
          tableNumber: t.tableNumber,
          size: t.players.length,
          players: t.players.map((p) => ({ ...p, skillLevel: 0 })),
        }))
      : null;

  return (
    <div className="flex flex-col gap-4">
      <CasualInfo />
      <CasualClient players={players} initialTables={initialTables} />
    </div>
  );
}
