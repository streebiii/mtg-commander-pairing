/**
 * Trägt einen Liga-Abend aus der Zeit vor der App nach — aus den
 * Punkteblättern abgelesen (siehe SPEC.md Abschnitt 13.3).
 *
 *   npm run import:evening -- <datei.json>            Probelauf, schreibt nichts
 *   npm run import:evening -- <datei.json> --apply    schreibt in die Datenbank
 *
 * Die Datenbank kommt aus DATABASE_URL. Die JSON-Datei enthält Namen und
 * Achievements einzelner Spieler und gehört deshalb nicht ins öffentliche
 * Repository (Ablage in `information-files/`).
 *
 * Format:
 *   {
 *     "date": "2026-05-22",
 *     "seasonRound": 2,
 *     "rotating": ["He’s Dead, Jim", …],          // die 10 dieses Abends
 *     "players": [
 *       { "name": "Rolf Bammerlin", "games": [1, 2], "total": 8,
 *         "marks": [["I’ve seen this movie", 1], ["No Sol Ring", 0], …] }
 *     ]
 *   }
 *
 * Eine Markierung ist [Titel, Spiel] oder [Titel, Spiel, Anzahl]; Spiel 0
 * heisst ganzer Abend. Participation setzt die App selbst für jedes Spiel
 * in `games`. `total` ist der Wert von mtgbl.ch — weicht die Summe der
 * Markierungen davon ab, bricht das Skript ab, ohne etwas zu schreiben.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, type Achievement } from "@prisma/client";
import { eveningCopy } from "@/lib/achievements";
import {
  computeBreakdown,
  isParticipation,
  markKey,
  maxCount,
  validGame,
  type SheetAchievement,
} from "@/lib/entrySheet";
import { formatPlayerName } from "@/lib/players";
import { EVENINGS_PER_SEASON, isInSeason, isLastEvening } from "@/lib/season";

interface ImportFile {
  date: string;
  seasonRound: number;
  rotating: string[];
  players: {
    name: string;
    games: number[];
    total: number;
    marks: ([string, number] | [string, number, number])[];
  }[];
}

/** Titel vergleichen, ohne an Gross-/Kleinschreibung oder Apostroph-Varianten zu scheitern. */
const norm = (title: string) => title.toLowerCase().replace(/[’`´]/g, "'").trim();

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("Aufruf: import-evening <datei.json> [--apply]");
  const apply = flag === "--apply";
  const data = JSON.parse(readFileSync(file, "utf8")) as ImportFile;

  // Abends um 19 Uhr Schweizer Zeit — der Tag zählt, nicht die Uhrzeit.
  const date = new Date(`${data.date}T19:00:00+02:00`);
  if (Number.isNaN(date.getTime()) || !isInSeason(date)) {
    throw new Error(`Datum ${data.date} liegt nicht in der laufenden Saison`);
  }
  if (!Number.isInteger(data.seasonRound) || data.seasonRound < 1 || data.seasonRound > EVENINGS_PER_SEASON) {
    throw new Error(`Ungültige Spalte R${data.seasonRound}`);
  }

  const prisma = new PrismaClient();
  try {
    const taken = await prisma.evening.findMany({
      where: { seasonRound: data.seasonRound },
      select: { date: true },
    });
    if (taken.some((e) => isInSeason(e.date))) {
      throw new Error(`R${data.seasonRound} ist schon einem Abend zugeordnet`);
    }

    // Was an diesem Abend galt: alle fixen und Deckbau-Achievements des
    // Katalogs und die zehn rotierenden der damaligen Ziehung.
    const catalog = await prisma.achievement.findMany();
    const byTitle = new Map(catalog.map((a) => [norm(a.title), a]));
    const rotating = data.rotating.map((title) => {
      const a = byTitle.get(norm(title));
      if (!a || a.category !== "ROTATING") throw new Error(`Rotierendes Achievement fehlt im Katalog: ${title}`);
      return a;
    });
    const evening: Achievement[] = [
      ...catalog.filter((a) => a.category !== "ROTATING" && a.active),
      ...rotating,
    ];
    const eveningByTitle = new Map(evening.map((a) => [norm(a.title), a]));
    const sheet: SheetAchievement[] = evening.map((a) => ({ ...a }));
    const lastEvening = isLastEvening(date);

    const players = await prisma.player.findMany();
    const errors: string[] = [];
    const rows = data.players.map((p) => {
      const matches = players.filter((pl) => norm(formatPlayerName(pl)) === norm(p.name));
      if (matches.length !== 1) errors.push(`${p.name}: ${matches.length} Spieler mit diesem Namen`);

      const marks = p.marks.map(([title, game, count = 1]) => {
        const a = eveningByTitle.get(norm(title));
        if (!a) {
          errors.push(`${p.name}: «${title}» gilt an diesem Abend nicht`);
        } else if (isParticipation(a)) {
          errors.push(`${p.name}: Participation setzt die App selbst`);
        } else if (!validGame(a.scope, game, p.games) || count < 1 || count > maxCount(a.scope)) {
          errors.push(`${p.name}: «${title}» in Spiel ${game} ×${count} ist nicht zulässig`);
        }
        return { achievement: a, game, count };
      });

      const total = computeBreakdown(
        sheet,
        new Map(marks.filter((m) => m.achievement).map((m) => [markKey(m.achievement!.id, m.game), m.count])),
        p.games,
        lastEvening,
      ).total;
      if (total !== p.total) errors.push(`${p.name}: Summe ${total}, mtgbl.ch ${p.total}`);

      return { name: p.name, player: matches[0], games: p.games, marks, total };
    });

    for (const r of rows) console.log(`${r.total.toString().padStart(3)}  ${r.name}`);
    console.log(`${rows.length} Spieler, ${evening.length} Achievements, R${data.seasonRound} am ${data.date}`);
    if (errors.length > 0) {
      console.error(`\n${errors.length} Problem(e) — nichts geschrieben:\n- ${errors.join("\n- ")}`);
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log("\nProbelauf in Ordnung. Mit --apply schreiben.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.evening.create({
        data: { date, finishedAt: date, entryClosedAt: date, seasonRound: data.seasonRound },
      });
      const copies = await tx.eveningAchievement.createManyAndReturn({
        data: evening.map((a) => eveningCopy(created.id, a)),
      });
      const copyOf = new Map(copies.map((c) => [c.achievementId, c.id]));
      for (const r of rows) {
        await tx.playerEntry.create({
          data: {
            eveningId: created.id,
            playerId: r.player.id,
            games: r.games,
            submittedAt: date,
            marks: {
              create: r.marks.map((m) => ({
                eveningAchievementId: copyOf.get(m.achievement!.id)!,
                game: m.game,
                count: m.count,
              })),
            },
          },
        });
      }
    });
    console.log("\nGeschrieben.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
