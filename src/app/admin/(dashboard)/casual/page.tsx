import { prisma } from "@/lib/prisma";
import CasualClient from "./CasualClient";

export const dynamic = "force-dynamic";

export default async function CasualPage() {
  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Modus A — Casual-Rechner + Zuteilung</h1>
        <p className="text-sm opacity-70">
          Reine Anzahl-basierte Tischzuteilung ohne Rangliste. Einzelrunde,
          keine Punkte-/Ergebniserfassung, kein Verlauf (siehe SPEC.md
          Abschnitt 4).
        </p>
      </div>
      <CasualClient players={players} />
    </div>
  );
}
