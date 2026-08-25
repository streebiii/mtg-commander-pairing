import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import CasualClient from "./CasualClient";

export const dynamic = "force-dynamic";

export default async function CasualPage() {
  const rawPlayers = await prisma.player.findMany({
    where: { archivedAt: null },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });
  const players = rawPlayers.map((p) => ({
    id: p.id,
    name: formatPlayerName(p),
    skillLevel: p.skillLevel,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Casual</h1>
        <p className="text-sm opacity-70">
          Spieler auswählen · Tische auswürfeln · fertig. Eine Runde, keine
          Punkte, kein Verlauf.
        </p>
      </div>
      <CasualClient players={players} />
    </div>
  );
}
