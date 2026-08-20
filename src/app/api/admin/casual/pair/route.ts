import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { saveCasualPairing } from "@/lib/casualPairing";
import { prisma } from "@/lib/prisma";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import { assignCasualRound } from "@/lib/pairing/casualAssignment";
import { assignSkillBalancedCasualRound } from "@/lib/pairing/skillAssignment";
import { PairingError } from "@/lib/pairing/errors";
import { formatPlayerName } from "@/lib/players";

/**
 * Berechnet eine Modus-A-Tischzuteilung (Casual, keine Persistenz — siehe
 * SPEC.md Abschnitt 4). Zwei Untermodi (siehe Abschnitt 4.1):
 * - "random" (Standard): rein zufällige Zuteilung.
 * - "skill": nach Skill-Level balanciert, mit Zufallsfaktor.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const playerIds: unknown = body?.playerIds;
  const mode = body?.mode === "skill" ? "skill" : "random";

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
    where: { id: { in: playerIds as string[] }, archivedAt: null },
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });

  if (players.length !== playerIds.length) {
    return NextResponse.json(
      { error: "Einige Spieler-IDs wurden nicht gefunden" },
      { status: 400 },
    );
  }

  try {
    const sizes = computeTableSizes(players.length);
    const tables =
      mode === "skill"
        ? assignSkillBalancedCasualRound(players, sizes)
        : assignCasualRound(
            players.map((p) => p.id),
            sizes,
          );
    const nameById = new Map(players.map((p) => [p.id, formatPlayerName(p)]));
    const skillById = new Map(players.map((p) => [p.id, p.skillLevel]));

    // Sofort als aktuelle Zuteilung übernehmen, damit die öffentliche
    // Lese-Ansicht dieselben Tische zeigt (siehe SPEC.md Abschnitt 4).
    // Ersetzt eine eventuell vorhandene frühere Zuteilung vollständig.
    await saveCasualPairing(
      tables.map((table, i) => ({ tableNumber: i + 1, playerIds: table })),
    );
    revalidatePath("/");

    return NextResponse.json({
      tables: tables.map((table, i) => ({
        tableNumber: i + 1,
        size: table.length,
        players: table.map((id) => ({
          id,
          name: nameById.get(id) ?? "?",
          skillLevel: skillById.get(id) ?? 0,
        })),
      })),
    });
  } catch (err) {
    if (err instanceof PairingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
