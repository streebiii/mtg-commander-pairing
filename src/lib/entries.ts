import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isLastEvening } from "@/lib/season";
import {
  type SheetAchievement,
  type SheetMark,
  computeTotals,
  isParticipation,
  marksToMap,
  maxCount,
  validGame,
  visibleAchievements,
} from "@/lib/entrySheet";

// Achievement-Erfassung durch die Spieler (siehe SPEC.md Abschnitt 12).
// Ein Spieler meldet sich über eine Tischkarte an; sein Gerät bekommt ein
// zufälliges Token als Cookie, in der Datenbank steht nur dessen Hash.
// Solange ein Gerät einen Namen hält, kann kein anderes ihn wählen.

export const ENTRY_COOKIE_NAME = "liga_erfassung";

export const ENTRY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Reicht über den Abend hinaus, damit auch zu Hause noch eingetragen
  // werden kann — bis der Organisator die Erfassung schliesst.
  maxAge: 60 * 60 * 24 * 14,
};

export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Der Liga-Abend, für den gerade erfasst wird: der neueste, dessen
 * Erfassung noch nicht geschlossen ist — laufend oder schon beendet.
 */
export async function findOpenEvening() {
  return prisma.evening.findFirst({
    where: { mode: "LEAGUE", entryClosedAt: null, rounds: { some: {} } },
    orderBy: { createdAt: "desc" },
  });
}

/** Die Erfassung, die dieses Gerät per Cookie hält — oder null. */
export async function getDeviceEntry() {
  const raw = (await cookies()).get(ENTRY_COOKIE_NAME)?.value;
  if (!raw) return null;
  const [entryId, token] = raw.split(".");
  if (!entryId || !token) return null;

  const entry = await prisma.playerEntry.findUnique({
    where: { id: entryId },
    include: { evening: true, player: true },
  });
  if (!entry?.deviceTokenHash) return null;
  if (!sameHash(entry.deviceTokenHash, hashToken(token))) return null;
  return entry;
}

/**
 * Spiele (Runden-Nummern), in denen der Spieler an einem Tisch sass. Nur
 * veröffentlichte Runden — im Warteraum kann sich die Zuteilung noch
 * ändern, und der Spieler kennt seinen Tisch noch nicht.
 */
export async function gamesPlayed(eveningId: string, playerId: string) {
  const rounds = await prisma.round.findMany({
    where: {
      eveningId,
      publishedAt: { not: null },
      tables: { some: { assignments: { some: { playerId } } } },
    },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  return rounds.map((r) => r.number);
}

export interface SheetData {
  achievements: SheetAchievement[];
  marks: SheetMark[];
  gamesPlayed: number[];
  lastEvening: boolean;
}

/** Alles, was das Erfassungsblatt eines Spielers an einem Abend braucht. */
export async function loadSheet(
  eveningId: string,
  playerId: string,
): Promise<SheetData> {
  const [evening, achievements, entry, games] = await Promise.all([
    prisma.evening.findUniqueOrThrow({ where: { id: eveningId } }),
    prisma.eveningAchievement.findMany({
      where: { eveningId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.playerEntry.findUnique({
      where: { eveningId_playerId: { eveningId, playerId } },
      include: { marks: true },
    }),
    gamesPlayed(eveningId, playerId),
  ]);
  const lastEvening = isLastEvening(evening.date);
  return {
    achievements: visibleAchievements(
      achievements.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        points: a.points,
        category: a.category,
        scope: a.scope,
        systemKey: a.systemKey,
        sortOrder: a.sortOrder,
      })),
      lastEvening,
    ),
    marks:
      entry?.marks.map((m) => ({
        eveningAchievementId: m.eveningAchievementId,
        game: m.game,
        count: m.count,
      })) ?? [],
    gamesPlayed: games,
    lastEvening,
  };
}

export function sheetTotals(sheet: SheetData) {
  return computeTotals(
    sheet.achievements,
    marksToMap(sheet.marks),
    sheet.gamesPlayed,
    sheet.lastEvening,
  );
}

/**
 * Setzt die Anzahl eines Achievements in einer Erfassung (0 = entfernen).
 * Prüft alles, was der Browser schicken könnte: gehört das Achievement zu
 * diesem Abend, passt das Spiel, liegt die Anzahl im erlaubten Bereich.
 * Participation setzt die App selbst und ist hier nicht änderbar.
 */
export async function applyMark(
  entry: { id: string; eveningId: string; playerId: string },
  eveningAchievementId: string,
  game: number,
  count: number,
): Promise<boolean> {
  if (!Number.isInteger(game) || !Number.isInteger(count)) return false;

  const achievement = await prisma.eveningAchievement.findUnique({
    where: { id: eveningAchievementId },
  });
  if (!achievement || achievement.eveningId !== entry.eveningId) return false;
  if (isParticipation(achievement)) return false;
  if (count < 0 || count > maxCount(achievement.scope)) return false;

  const games = await gamesPlayed(entry.eveningId, entry.playerId);
  if (!validGame(achievement.scope, game, games)) return false;

  const where = {
    entryId_eveningAchievementId_game: {
      entryId: entry.id,
      eveningAchievementId,
      game,
    },
  };
  if (count === 0) {
    await prisma.achievementMark.deleteMany({
      where: { entryId: entry.id, eveningAchievementId, game },
    });
  } else {
    await prisma.achievementMark.upsert({
      where,
      create: { entryId: entry.id, eveningAchievementId, game, count },
      update: { count },
    });
  }
  return true;
}

export type EntryStatus = "offen" | "angemeldet" | "abgegeben";

export interface OverviewRow {
  playerId: string;
  name: { firstName: string; lastName: string | null };
  entryId: string | null;
  status: EntryStatus;
  hasDevice: boolean;
  total: number;
}

/**
 * Übersicht aller Anwesenden eines Abends mit Status und Total — mit einer
 * festen Zahl von Abfragen statt einer pro Spieler, weil Neon von Vercel
 * aus jede Abfrage einzeln kostet.
 */
export async function loadEveningOverview(eveningId: string) {
  const [evening, achievements, assignments, entries] = await Promise.all([
    prisma.evening.findUniqueOrThrow({ where: { id: eveningId } }),
    prisma.eveningAchievement.findMany({ where: { eveningId } }),
    prisma.tableAssignment.findMany({
      where: { table: { round: { eveningId, publishedAt: { not: null } } } },
      select: {
        playerId: true,
        player: { select: { firstName: true, lastName: true } },
        table: { select: { round: { select: { number: true } } } },
      },
    }),
    prisma.playerEntry.findMany({
      where: { eveningId },
      include: { marks: true },
    }),
  ]);
  const lastEvening = isLastEvening(evening.date);
  const sheetAchievements: SheetAchievement[] = achievements.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    points: a.points,
    category: a.category,
    scope: a.scope,
    systemKey: a.systemKey,
    sortOrder: a.sortOrder,
  }));

  const players = new Map<
    string,
    { name: OverviewRow["name"]; games: Set<number> }
  >();
  for (const a of assignments) {
    const p = players.get(a.playerId) ?? { name: a.player, games: new Set() };
    p.games.add(a.table.round.number);
    players.set(a.playerId, p);
  }
  const entryByPlayer = new Map(entries.map((e) => [e.playerId, e]));

  const rows: OverviewRow[] = [...players].map(([playerId, p]) => {
    const entry = entryByPlayer.get(playerId);
    const totals = computeTotals(
      sheetAchievements,
      marksToMap(entry?.marks ?? []),
      [...p.games].sort((x, y) => x - y),
      lastEvening,
    );
    return {
      playerId,
      name: p.name,
      entryId: entry?.id ?? null,
      status: entry?.submittedAt
        ? "abgegeben"
        : entry?.deviceTokenHash
          ? "angemeldet"
          : "offen",
      hasDevice: Boolean(entry?.deviceTokenHash),
      total: totals.total,
    };
  });
  rows.sort((a, b) =>
    a.name.firstName.localeCompare(b.name.firstName, "de-CH"),
  );
  return { evening, rows };
}
