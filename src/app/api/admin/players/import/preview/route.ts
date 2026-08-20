import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLeagueImport } from "@/lib/importParser";
import { matchImportRows } from "@/lib/playerMatch";

/**
 * Parst den eingefügten Rangliste-Text und schlägt für jede Zeile vor, ob
 * ein bestehender Spieler aktualisiert, ein neuer Spieler angelegt werden
 * soll, oder ob es mehrdeutig ist (Organisator muss wählen). Schreibt noch
 * nichts in die Datenbank — siehe /api/admin/players/import/apply.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Kein Text übergeben" }, { status: 400 });
  }

  const { rows, warnings } = parseLeagueImport(text);
  const players = await prisma.player.findMany({
    where: { archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  const matches = matchImportRows(rows, players);

  return NextResponse.json({ matches, warnings });
}
