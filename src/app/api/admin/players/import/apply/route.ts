import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface UpdateResolution {
  action: "update";
  playerId: string;
  total: number;
}
interface CreateResolution {
  action: "create";
  firstName: string;
  lastName: string | null;
  total: number;
}
interface SkipResolution {
  action: "skip";
}
type Resolution = UpdateResolution | CreateResolution | SkipResolution;

function isResolution(value: unknown): value is Resolution {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.action === "skip") return true;
  if (v.action === "update") {
    return typeof v.playerId === "string" && typeof v.total === "number";
  }
  if (v.action === "create") {
    return (
      typeof v.firstName === "string" &&
      (v.lastName === null || typeof v.lastName === "string") &&
      typeof v.total === "number"
    );
  }
  return false;
}

/**
 * Wendet die vom Organisator bestätigten Import-Entscheidungen an: setzt
 * den Punktestand bestehender Spieler auf den importierten Total-Wert
 * (kein Aufaddieren — der Import liefert bereits den aktuellen
 * Saison-Gesamtstand), oder legt neue Spieler an.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const resolutions: unknown = body?.resolutions;

  if (!Array.isArray(resolutions) || !resolutions.every(isResolution)) {
    return NextResponse.json(
      { error: "Ungültige resolutions" },
      { status: 400 },
    );
  }

  let updated = 0;
  let created = 0;

  for (const resolution of resolutions as Resolution[]) {
    if (resolution.action === "skip") continue;
    if (resolution.action === "update") {
      await prisma.player.update({
        where: { id: resolution.playerId },
        data: { points: resolution.total },
      });
      updated++;
    } else if (resolution.action === "create") {
      await prisma.player.create({
        data: {
          firstName: resolution.firstName,
          lastName: resolution.lastName,
          points: resolution.total,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ updated, created });
}
