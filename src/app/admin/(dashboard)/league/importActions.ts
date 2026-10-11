"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import { parseLeagueImport } from "@/lib/importParser";
import { normalizeColorIdentity } from "@/lib/colorIdentity";
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

/** Was der Import zu einem Spieler mitbringt. */
interface ImportedValues {
  total: number;
  attendedEvenings: number;
  roundPoints: { round: number; points: number }[];
  /** undefined = die Tabelle hatte keine Spalte F. */
  colorIdentity?: string | null;
}

export type ImportResolution =
  | ({ action: "update"; playerId: string } & ImportedValues)
  | ({ action: "create"; firstName: string; lastName: string | null } & ImportedValues)
  | { action: "skip" };

function isRoundPoints(value: unknown): value is ImportedValues["roundPoints"] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        Number.isInteger(r?.round) &&
        r.round >= 1 &&
        r.round <= 6 &&
        Number.isInteger(r?.points),
    ) &&
    new Set(value.map((r) => r.round)).size === value.length
  );
}

function isResolution(value: unknown): value is ImportResolution {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.action === "skip") return true;
  if (
    typeof v.total !== "number" ||
    typeof v.attendedEvenings !== "number" ||
    !isRoundPoints(v.roundPoints) ||
    !(v.colorIdentity === undefined || v.colorIdentity === null || typeof v.colorIdentity === "string")
  ) {
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
 *
 * Die Punkte pro Abend ersetzen die bisher importierten des Spielers
 * komplett — aber nur bei Spielern, die dieser Import übernimmt. Wer
 * übersprungen wird oder nicht im Text steht, behält seine Werte (SPEC.md
 * Abschnitt 13).
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
    if (r.action === "skip") continue;
    const values = {
      points: r.total,
      attendedEvenings: r.attendedEvenings,
      leagueActive: true,
      ...(r.colorIdentity === undefined
        ? {}
        : { colorIdentity: normalizeColorIdentity(r.colorIdentity) }),
    };
    await prisma.$transaction(async (tx) => {
      const player =
        r.action === "update"
          ? await tx.player.update({ where: { id: r.playerId }, data: values })
          : await tx.player.create({
              data: { firstName: r.firstName, lastName: r.lastName, ...values },
            });
      await tx.importedEveningScore.deleteMany({ where: { playerId: player.id } });
      await tx.importedEveningScore.createMany({
        data: r.roundPoints.map((p) => ({ playerId: player.id, ...p })),
      });
    });
    if (r.action === "update") updated++;
    else created++;
  }

  revalidatePath("/admin/league");
  revalidatePath("/admin/players");
  revalidatePath("/rangliste");
  return { updated, created };
}
