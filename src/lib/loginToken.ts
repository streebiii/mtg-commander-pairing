import { prisma } from "@/lib/prisma";

/** Gültigkeitsdauer eines Login-Links (siehe SPEC.md Abschnitt 2). */
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 Minuten

/** Rate-Limit gegen Missbrauch/Email-Spam beim Anfordern von Login-Links. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const RATE_LIMIT_MAX_REQUESTS = 5;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32); // 256 Bit Zufall
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Prüft, ob in den letzten RATE_LIMIT_WINDOW_MS bereits zu viele Login-Links
 * angefordert wurden. Da es nur einen Organisator/eine Email-Adresse gibt,
 * reicht ein einfacher Zähler über alle erzeugten Tokens (keine
 * IP-/Nutzer-spezifische Unterscheidung nötig).
 */
export async function isRateLimited(): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.loginToken.count({
    where: { createdAt: { gte: since } },
  });
  return count >= RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Erzeugt einen neuen Einmal-Login-Token. Gibt den rohen Token zurück (für
 * den Email-Link) — in der Datenbank landet nur dessen Hash.
 */
export async function createLoginToken(): Promise<string> {
  const rawToken = randomToken();
  const tokenHash = await hashToken(rawToken);
  await prisma.loginToken.create({
    data: { tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return rawToken;
}

/**
 * Löst einen Login-Token ein: gültig nur, wenn er existiert, noch nicht
 * abgelaufen und noch nicht verwendet wurde. Markiert ihn danach als
 * verwendet (Replay-Schutz — derselbe Link funktioniert kein zweites Mal).
 */
export async function consumeLoginToken(rawToken: string | null): Promise<boolean> {
  if (!rawToken) return false;

  const tokenHash = await hashToken(rawToken);
  const record = await prisma.loginToken.findUnique({ where: { tokenHash } });
  if (!record) return false;
  if (record.usedAt) return false;
  if (record.expiresAt.getTime() < Date.now()) return false;

  await prisma.loginToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return true;
}
