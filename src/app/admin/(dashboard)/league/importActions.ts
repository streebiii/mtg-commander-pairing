"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { parseLeagueImport } from "@/lib/importParser";
import { matchImportRows, type ImportMatch } from "@/lib/playerMatch";

// Import der Saison-Rangliste von mtgbl.ch (siehe SPEC.md Abschnitt 7).

/**
 * Parst den eingefügten Rangliste-Text und schlägt für jede Zeile vor, ob
 * ein bestehender Spieler aktualisiert, ein neuer angelegt werden soll,
 * oder ob es mehrdeutig ist (der Organisator wählt). Schreibt noch nichts.
 */
export async function previewImport(
  text: unknown,
): Promise<{ error: string } | { matches: ImportMatch[]; warnings: string[] }> {
  await requireAdmin();
  if (typeof text !== "string" || !text.trim()) {
    return { error: "Kein Text übergeben" };
  }

  const { rows, warnings } = parseLeagueImport(text);
  const players = await prisma.player.findMany({
    where: { archivedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  return { matches: matchImportRows(rows, players), warnings };
}

export type ImportResolution =
  | { action: "update"; playerId: string; total: number; attendedEvenings: number }
  | {
      action: "create";
      firstName: string;
      lastName: string | null;
      total: number;
      attendedEvenings: number;
    }
  | { action: "skip" };

function isResolution(value: unknown): value is ImportResolution {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.action === "skip") return true;
  if (typeof v.total !== "number" || typeof v.attendedEvenings !== "number") {
    return false;
  }
  if (v.action === "update") return typeof v.playerId === "string";
  if (v.action === "create") {
    return (
      typeof v.firstName === "string" &&
      (v.lastName === null || typeof v.lastName === "string")
    );
  }
  return false;
}

/**
 * Wendet die bestätigten Entscheidungen an. Kein Aufaddieren: Punktestand
 * und Abendzahl werden auf die importierten Werte gesetzt, denn die
 * Rangliste liefert bereits den aktuellen Saisonstand. Alle betroffenen
 * Spieler werden als Liga-teilnehmend markiert.
 */
export async function applyImport(
  resolutions: unknown,
): Promise<{ error: string } | { updated: number; created: number }> {
  await requireAdmin();
  if (!Array.isArray(resolutions) || !resolutions.every(isResolution)) {
    return { error: "Ungültige Import-Daten" };
  }

  let updated = 0;
  let created = 0;
  for (const r of resolutions) {
    if (r.action === "update") {
      await prisma.player.update({
        where: { id: r.playerId },
        data: { points: r.total, attendedEvenings: r.attendedEvenings, leagueActive: true },
      });
      updated++;
    } else if (r.action === "create") {
      await prisma.player.create({
        data: {
          firstName: r.firstName,
          lastName: r.lastName,
          points: r.total,
          attendedEvenings: r.attendedEvenings,
          leagueActive: true,
        },
      });
      created++;
    }
  }

  revalidatePath("/admin/league");
  revalidatePath("/admin/players");
  return { updated, created };
}
