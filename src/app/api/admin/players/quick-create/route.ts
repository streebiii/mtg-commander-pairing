import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPlayerName, parseSkillLevel, SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from "@/lib/players";

/**
 * Legt schnell einen neuen Spieler an — gedacht für die Spielerauswahl in
 * Modus A, wenn jemand auftaucht, der noch nicht in der Datenbank ist.
 * Punktestand startet bei 0 (Liga-Punkte sind für Modus A irrelevant und
 * können später in der Spielerverwaltung nachgepflegt werden).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const skillLevel = parseSkillLevel(body?.skillLevel ?? 0);

  if (!firstName) {
    return NextResponse.json({ error: "Vorname fehlt" }, { status: 400 });
  }
  if (skillLevel === null) {
    return NextResponse.json(
      { error: `Stufe muss zwischen ${SKILL_LEVEL_MIN} und ${SKILL_LEVEL_MAX} liegen` },
      { status: 400 },
    );
  }

  const player = await prisma.player.create({
    data: { firstName, lastName: lastName || null, skillLevel, points: 0 },
  });

  return NextResponse.json({
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    skillLevel: player.skillLevel,
    name: formatPlayerName(player),
  });
}
