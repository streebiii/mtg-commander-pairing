import { hmacWithSessionSecret } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Gültigkeitsdauer eines Login-Codes (siehe SPEC.md Abschnitt 2). */
const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 Minuten

/**
 * Rate-Limit gegen Missbrauch/Email-Spam beim Anfordern von Codes. Das
 * Limit pro IP bremst einen einzelnen Störer, ohne dass er damit den
 * Organisator aussperren kann; die globale Obergrenze schützt das Postfach,
 * falls jemand von vielen Adressen aus anfordert.
 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const RATE_LIMIT_MAX_PER_IP = 5;
const RATE_LIMIT_MAX_TOTAL = 20;

/** Ältere Codes werden beim Anfordern eines neuen gelöscht (Datensparsamkeit). */
const TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000; // 1 Tag

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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

const hashCode = sha256Hex;

/**
 * Zufälliger Wert für das Browser-Cookie, an das ein Code gebunden wird
 * (siehe `browserHash` im Schema). 256 Bit, nicht zu erraten.
 */
export function newBrowserId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** Normalisiert eine Eingabe: alles ausser Ziffern fliegt raus. */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Prüft, ob in den letzten RATE_LIMIT_WINDOW_MS zu viele Codes angefordert
 * wurden — von dieser IP oder insgesamt.
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [fromIp, total] = await Promise.all([
    prisma.loginToken.count({
      where: { createdAt: { gte: since }, ipHash: await hmacWithSessionSecret(ip) },
    }),
    prisma.loginToken.count({ where: { createdAt: { gte: since } } }),
  ]);
  return fromIp >= RATE_LIMIT_MAX_PER_IP || total >= RATE_LIMIT_MAX_TOTAL;
}

/**
 * Erzeugt einen neuen Einmal-Code, gebunden an den anfordernden Browser.
 * Gibt den Code im Klartext zurück (für die Email) — in der Datenbank
 * landet nur dessen Hash.
 *
 * Ausserhalb von Produktion ist der Code fest "123456" — erspart das
 * Ablesen aus dem Server-Log bei jedem lokalen Test. Derselbe
 * NODE_ENV-Schutz wie beim SMTP-Fallback in email.ts und der
 * /dev-login-Route: in Produktion greift das nie, dort bleibt der Code
 * immer echt zufällig.
 */
export async function createLoginCode(browserId: string, ip: string): Promise<string> {
  const code =
    process.env.NODE_ENV === "production" ? randomCode() : "123456";
  const [tokenHash, browserHash, ipHash] = await Promise.all([
    hashCode(code),
    sha256Hex(browserId),
    hmacWithSessionSecret(ip),
  ]);
  await prisma.loginToken.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - TOKEN_RETENTION_MS) } },
  });
  await prisma.loginToken.create({
    data: {
      tokenHash,
      browserHash,
      ipHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return code;
}

export type ConsumeResult = "ok" | "invalid" | "too_many_attempts";

/**
 * Löst einen Login-Code ein. Gültig nur, wenn er aus demselben Browser
 * kommt, der ihn angefordert hat, noch nicht abgelaufen, noch nicht
 * verwendet und nicht durch zu viele Versuche verbrannt ist. Nach Erfolg
 * wird er als verwendet markiert (Replay-Schutz).
 *
 * Jeder Versuch verbucht zuerst einen Versuch auf *allen* offenen Codes
 * dieses Browsers — in einem einzigen UPDATE mit der Bedingung
 * `attempts < MAX_CODE_ATTEMPTS`. Erst danach wird verglichen. So bleibt
 * das Limit auch dann hart, wenn jemand hunderte Versuche gleichzeitig
 * schickt: die Datenbank lässt pro Code nur MAX_CODE_ATTEMPTS Erhöhungen
 * zu, und nur wer eine davon bekommen hat, darf vergleichen.
 */
export async function consumeLoginCode(
  rawInput: string | null,
  browserId: string | undefined,
): Promise<ConsumeResult> {
  if (!browserId) return "invalid";
  const code = normalizeCode(rawInput ?? "");
  const browserHash = await sha256Hex(browserId);
  const now = new Date();
  const open = { browserHash, usedAt: null, expiresAt: { gt: now } };

  const reserved = await prisma.loginToken.updateManyAndReturn({
    where: { ...open, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  if (reserved.length === 0) {
    // Entweder gibt es gar keinen offenen Code, oder alle sind verbrannt.
    const burned = await prisma.loginToken.count({ where: open });
    return burned > 0 ? "too_many_attempts" : "invalid";
  }

  if (code.length === CODE_LENGTH) {
    const tokenHash = await hashCode(code);
    const match = reserved.find((t) => t.tokenHash === tokenHash);
    if (match) {
      const { count } = await prisma.loginToken.updateMany({
        where: { id: match.id, usedAt: null },
        data: { usedAt: now },
      });
      if (count === 1) return "ok";
    }
  }

  const budgetLeft = reserved.some((t) => t.attempts < MAX_CODE_ATTEMPTS);
  return budgetLeft ? "invalid" : "too_many_attempts";
}
