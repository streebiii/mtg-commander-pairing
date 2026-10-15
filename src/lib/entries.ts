import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { EVENINGS_PER_SEASON, isInSeason, isLastEvening } from "@/lib/season";
import { setWinnerByPlayer } from "@/lib/winner";
import {
  type SheetAchievement,
  type SheetMark,
  computeTotals,
  isParticipation,
  isWinnerAchievement,
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
    where: { entryClosedAt: null, rounds: { some: {} } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Prüft die Spalte (R1–R6), in der ein Abend beim Schliessen seiner
 * Erfassung zählen soll; null heisst Testrunde und ist immer erlaubt. Jede
 * Spalte gehört höchstens einem Abend der Saison, sonst wäre nicht klar,
 * welcher gilt. Gibt die Fehlermeldung zurück oder null.
 */
export async function seasonRoundError(
  eveningId: string,
  seasonRound: number | null,
): Promise<string | null> {
  if (seasonRound === null) return null;
  if (!Number.isInteger(seasonRound) || seasonRound < 1 || seasonRound > EVENINGS_PER_SEASON) {
    return "Ungültige Spalte";
  }
  const taken = await prisma.evening.findMany({
    where: { id: { not: eveningId }, seasonRound },
    select: { date: true },
  });
  const conflict = taken.find((e) => isInSeason(e.date));
  if (!conflict) return null;
  const day = conflict.date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
  return `R${seasonRound} ist schon der Runde vom ${day} zugeordnet.`;
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
 *
 * Nachgetragene Abende haben keine Tische; dort steht in der Erfassung,
 * welche Spiele es waren (SPEC.md Abschnitt 13.3).
 */
export async function gamesPlayed(eveningId: string, playerId: string) {
  const [rounds, entry] = await Promise.all([
    prisma.round.findMany({
      where: {
        eveningId,
        publishedAt: { not: null },
        tables: { some: { assignments: { some: { playerId } } } },
      },
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    prisma.playerEntry.findUnique({
      where: { eveningId_playerId: { eveningId, playerId } },
      select: { games: true },
    }),
  ]);
  if (rounds.length === 0 && entry?.games.length) {
    return [...entry.games].sort((a, b) => a - b);
  }
  return rounds.map((r) => r.number);
}

/** Runden des Abends, die schon live sind — ab dann lässt sich das Spiel erfassen. */
export async function liveRounds(eveningId: string) {
  const rounds = await prisma.round.findMany({
    where: { eveningId, publishedAt: { not: null } },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  return rounds.map((r) => r.number);
}

/** Ein Abend-Achievement, wie das Erfassungsblatt es braucht. */
export function toSheetAchievement(a: SheetAchievement): SheetAchievement {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    points: a.points,
    category: a.category,
    scope: a.scope,
    systemKey: a.systemKey,
    sortOrder: a.sortOrder,
  };
}

export interface SheetData {
  achievements: SheetAchievement[];
  marks: SheetMark[];
  gamesPlayed: number[];
  /** Runden, die schon live sind (siehe `liveRounds`). */
  liveRounds: number[];
  lastEvening: boolean;
  /** Die Runde ist beendet — ein nicht gestartetes Match kommt nicht mehr. */
  finished: boolean;
}

/** Alles, was das Erfassungsblatt eines Spielers an einem Abend braucht. */
export async function loadSheet(
  eveningId: string,
  playerId: string,
): Promise<SheetData> {
  const [evening, achievements, entry, games, live] = await Promise.all([
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
    liveRounds(eveningId),
  ]);
  const lastEvening = isLastEvening(evening.date);
  return {
    achievements: visibleAchievements(
      achievements.map(toSheetAchievement),
      lastEvening,
    ),
    marks:
      entry?.marks.map((m) => ({
        eveningAchievementId: m.eveningAchievementId,
        game: m.game,
        count: m.count,
      })) ?? [],
    gamesPlayed: games,
    liveRounds: live,
    lastEvening,
    finished: evening.finishedAt !== null,
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

/**
 * Eine Änderung durch den Spieler selbst. Wie `applyMark`, nur dass
 * «Winner winner» über das Tisch-Ergebnis läuft (lib/winner.ts) — der
 * Organisator korrigiert dagegen frei.
 */
export async function applyPlayerMark(
  entry: { id: string; eveningId: string; playerId: string },
  eveningAchievementId: string,
  game: number,
  count: number,
): Promise<boolean> {
  const achievement = await prisma.eveningAchievement.findUnique({
    where: { id: eveningAchievementId },
    select: { eveningId: true, systemKey: true },
  });
  if (achievement?.eveningId === entry.eveningId && isWinnerAchievement(achievement)) {
    if (count !== 0 && count !== 1) return false;
    return setWinnerByPlayer(entry, game, count === 1);
  }
  return applyMark(entry, eveningAchievementId, game, count);
}

export type EntryStatus = "offen" | "angemeldet" | "abgegeben";

export interface OverviewRow {
  playerId: string;
  name: { firstName: string; lastName: string | null };
  entryId: string | null;
  status: EntryStatus;
  hasDevice: boolean;
  /** Gespielte Matches (1, 2). */
  games: number[];
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
      include: {
        marks: true,
        player: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const lastEvening = isLastEvening(evening.date);
  const sheetAchievements = achievements.map(toSheetAchievement);

  const players = new Map<
    string,
    { name: OverviewRow["name"]; games: Set<number> }
  >();
  for (const a of assignments) {
    const p = players.get(a.playerId) ?? { name: a.player, games: new Set() };
    p.games.add(a.table.round.number);
    players.set(a.playerId, p);
  }
  // Nachgetragene Runden haben keine Tische — dort steht in der Erfassung,
  // welche Matches jemand gespielt hat (SPEC.md Abschnitt 13.3).
  for (const e of entries) {
    if (!players.has(e.playerId) && e.games.length > 0) {
      players.set(e.playerId, { name: e.player, games: new Set(e.games) });
    }
  }
  const entryByPlayer = new Map(entries.map((e) => [e.playerId, e]));

  const rows: OverviewRow[] = [...players].map(([playerId, p]) => {
    const entry = entryByPlayer.get(playerId);
    const games = [...p.games].sort((x, y) => x - y);
    const totals = computeTotals(
      sheetAchievements,
      marksToMap(entry?.marks ?? []),
      games,
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
      games,
      total: totals.total,
    };
  });
  rows.sort((a, b) =>
    a.name.firstName.localeCompare(b.name.firstName, "de-CH"),
  );
  return { evening, rows };
}
