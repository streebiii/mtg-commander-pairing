import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { getCasualPairing } from "@/lib/casualPairing";
import CasualClient from "./CasualClient";
import CasualInfo from "./CasualInfo";

export const dynamic = "force-dynamic";

export default async function CasualPage() {
  const [rawPlayers, pairing] = await Promise.all([
    prisma.player.findMany({
      where: { archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    getCasualPairing(),
  ]);
  const players = rawPlayers.map((p) => ({ id: p.id, name: formatPlayerName(p) }));

  // Die zuletzt berechnete Zuteilung liegt ohnehin in der Datenbank —
  // von dort wird sie beim Laden als Startzustand übernommen, damit ein
  // Reload sie nicht verschluckt.
  const initialTables =
    pairing?.tables.map((t) => ({
      tableNumber: t.tableNumber,
      size: t.players.length,
      players: t.players,
    })) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <CasualInfo />
      <CasualClient
        players={players}
        initialTables={initialTables}
        initialPublished={pairing?.published ?? false}
      />
    </div>
  );
}
