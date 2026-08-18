import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import { assignCasualRound } from "@/lib/pairing/casualAssignment";
import { PairingError } from "@/lib/pairing/errors";

/**
 * Berechnet eine Modus-A-Tischzuteilung (Casual, keine Rangliste, keine
 * Persistenz — siehe SPEC.md Abschnitt 4). Nimmt eine Liste von Spieler-IDs
 * entgegen und gibt die berechneten Tische mit Namen zurück.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const playerIds: unknown = body?.playerIds;

  if (!Array.isArray(playerIds) || playerIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "playerIds muss ein Array von Strings sein" },
      { status: 400 },
    );
  }

  if (playerIds.length < 3) {
    return NextResponse.json(
      { error: "Mindestens 3 Spieler nötig für ein Pairing" },
      { status: 400 },
    );
  }

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds as string[] } },
    select: { id: true, name: true },
  });

  if (players.length !== playerIds.length) {
    return NextResponse.json(
      { error: "Einige Spieler-IDs wurden nicht gefunden" },
      { status: 400 },
    );
  }

  try {
    const sizes = computeTableSizes(players.length);
    const tables = assignCasualRound(
      players.map((p) => p.id),
      sizes,
    );
    const nameById = new Map(players.map((p) => [p.id, p.name]));

    return NextResponse.json({
      tables: tables.map((table, i) => ({
        tableNumber: i + 1,
        size: table.length,
        players: table.map((id) => ({ id, name: nameById.get(id) ?? "?" })),
      })),
    });
  } catch (err) {
    if (err instanceof PairingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
