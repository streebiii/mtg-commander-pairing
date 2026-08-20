import { prisma } from "@/lib/prisma";

/** Gültigkeitsdauer eines Login-Codes (siehe SPEC.md Abschnitt 2). */
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 Minuten

/** Rate-Limit gegen Missbrauch/Email-Spam beim Anfordern von Codes. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const RATE_LIMIT_MAX_REQUESTS = 5;

/** Länge des Codes in Ziffern. */
export const CODE_LENGTH = 6;

/**
 * Erlaubte Fehleingaben pro ausgestelltem Code.
 *
 * Ein sechsstelliger Code hat nur 10^6 Möglichkeiten — verglichen mit dem
 * früheren 256-Bit-Link ist das verschwindend wenig. Ohne Bremse liesse er
 * sich in Minuten durchprobieren. Mit maximal 5 Versuchen pro Code liegt
 * die Trefferchance eines Angreifers bei 5 zu 1'000'000, und das auch nur
 * innerhalb der 10 Minuten Gültigkeit.
 */
const MAX_CODE_ATTEMPTS = 5;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Erzeugt einen gleichverteilten sechsstelligen Code (000000-999999).
 *
 * Bewusst per Rejection Sampling statt `% 1000000`: der Modulo-Weg würde
 * kleine Werte leicht bevorzugen, weil 2^32 kein Vielfaches von 10^6 ist.
 */
function randomCode(): string {
  const limit = 10 ** CODE_LENGTH;
  const maxUsable = Math.floor(0xffffffff / limit) * limit;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= maxUsable);
  return String(value % limit).padStart(CODE_LENGTH, "0");
}

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return bytesToHex(new Uint8Array(digest));
}

/** Normalisiert eine Eingabe: alles ausser Ziffern fliegt raus. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Prüft, ob in den letzten RATE_LIMIT_WINDOW_MS bereits zu viele Codes
 * angefordert wurden. Da es nur einen Organisator/eine Email-Adresse gibt,
 * reicht ein einfacher Zähler über alle erzeugten Codes (keine
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
 * Erzeugt einen neuen Einmal-Code. Gibt den Code im Klartext zurück (für
 * die Email) — in der Datenbank landet nur dessen Hash.
 */
export async function createLoginCode(): Promise<string> {
  const code = randomCode();
  const tokenHash = await hashCode(code);
  await prisma.loginToken.create({
    data: { tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return code;
}

export type ConsumeResult = "ok" | "invalid" | "too_many_attempts";

/**
 * Löst einen Login-Code ein. Gültig nur, wenn er existiert, noch nicht
 * abgelaufen, noch nicht verwendet und nicht durch zu viele Fehlversuche
 * verbrannt ist. Nach Erfolg wird er als verwendet markiert (Replay-Schutz).
 *
 * Bei einer Fehleingabe wird der Fehlversuch-Zähler *aller* offenen Codes
 * erhöht. Anders ginge es nicht: zu einem falsch geratenen Code gibt es
 * keinen Datensatz, den man belasten könnte. So kostet jeder Rateversuch
 * garantiert Budget.
 */
export async function consumeLoginCode(rawInput: string | null): Promise<ConsumeResult> {
  const code = normalizeCode(rawInput ?? "");
  const now = new Date();

  // Offene Codes: noch nicht eingelöst, noch nicht abgelaufen.
  const openTokens = await prisma.loginToken.findMany({
    where: { usedAt: null, expiresAt: { gt: now } },
  });

  const live = openTokens.filter((t) => t.attempts < MAX_CODE_ATTEMPTS);
  if (live.length === 0) {
    // Entweder gibt es gar keinen offenen Code, oder alle sind verbrannt.
    return openTokens.length > 0 ? "too_many_attempts" : "invalid";
  }

  if (code.length === CODE_LENGTH) {
    const tokenHash = await hashCode(code);
    const match = live.find((t) => t.tokenHash === tokenHash);
    if (match) {
      await prisma.loginToken.update({
        where: { id: match.id },
        data: { usedAt: now },
      });
      return "ok";
    }
  }

  await prisma.loginToken.updateMany({
    where: { id: { in: live.map((t) => t.id) } },
    data: { attempts: { increment: 1 } },
  });

  const budgetLeft = live.some((t) => t.attempts + 1 < MAX_CODE_ATTEMPTS);
  return budgetLeft ? "invalid" : "too_many_attempts";
}
