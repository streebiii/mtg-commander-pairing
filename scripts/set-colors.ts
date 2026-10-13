/**
 * Setzt die Farbidentitäten der Spieler, wie sie in der Spalte F der
 * Rangliste auf mtgbl.ch stehen (siehe SPEC.md Abschnitt 13.1).
 *
 *   npm run set:colors -- <datei.json>            Probelauf, schreibt nichts
 *   npm run set:colors -- <datei.json> --apply    schreibt in die Datenbank
 *
 * Die Datenbank kommt aus DATABASE_URL. Die JSON-Datei enthält Namen und
 * gehört deshalb nicht ins öffentliche Repository (Ablage in
 * `information-files/`). Format — Namen so, wie mtgbl.ch sie führt:
 *
 *   [{ "name": "Marc S.", "colors": "WR" }, { "name": "Fabian", "colors": "UG" }, …]
 *
 * Jeder Name muss genau einem Spieler zugeordnet werden können
 * (`matchPlayerName`); sonst bricht das Skript ab, ohne etwas zu schreiben.
 * Geändert wird ausschliesslich die Farbidentität.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { normalizeColorIdentity } from "@/lib/colorIdentity";
import { matchPlayerName } from "@/lib/nameMatch";
import { formatPlayerName } from "@/lib/players";

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("Aufruf: set-colors <datei.json> [--apply]");
  const apply = flag === "--apply";
  const rows = JSON.parse(readFileSync(file, "utf8")) as { name: string; colors: string }[];

  const prisma = new PrismaClient();
  try {
    const players = await prisma.player.findMany({ where: { archivedAt: null } });
    const errors: string[] = [];
    const updates = rows.map((row) => {
      const colors = normalizeColorIdentity(row.colors);
      const matches = matchPlayerName(row.name, players);
      if (!colors) errors.push(`${row.name}: «${row.colors}» ist keine Farbidentität`);
      if (matches.length !== 1) {
        errors.push(
          `${row.name}: ${matches.length} passende Spieler` +
            (matches.length > 1 ? ` (${matches.map(formatPlayerName).join(", ")})` : ""),
        );
      }
      return { row, colors, player: matches[0] };
    });

    for (const u of updates) {
      if (!u.player) continue;
      const before = u.player.colorIdentity ?? "–";
      const mark = before === u.colors ? " " : "*";
      console.log(`${mark} ${u.row.name.padEnd(16)} → ${formatPlayerName(u.player).padEnd(22)} ${before} → ${u.colors}`);
    }
    if (errors.length > 0) {
      console.error(`\n${errors.length} Problem(e), nichts geschrieben:`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log(`\nProbelauf: ${updates.length} Spieler zugeordnet (* = ändert sich). Mit --apply schreiben.`);
      return;
    }
    await prisma.$transaction(
      updates.map((u) =>
        prisma.player.update({ where: { id: u.player!.id }, data: { colorIdentity: u.colors } }),
      ),
    );
    console.log(`\n${updates.length} Farbidentitäten geschrieben.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
