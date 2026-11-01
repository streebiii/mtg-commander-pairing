import { constantTimeEqual, hmacWithSessionSecret } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Bremse gegen Durchprobieren des Organisator-Passworts (siehe SPEC.md
 * Abschnitt 2). Das Limit pro IP bremst einen einzelnen Angreifer; die
 * Obergrenze insgesamt greift, falls jemand von vielen Adressen aus rät.
 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const RATE_LIMIT_MAX_PER_IP = 5;
const RATE_LIMIT_MAX_TOTAL = 20;

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  // Ohne Passwort darf niemand hinein — auch nicht mit leerer Eingabe.
  if (!password) {
    throw new Error("ADMIN_PASSWORD ist nicht gesetzt (siehe .env.example).");
  }
  return password;
}

export type LoginResult = "ok" | "invalid" | "rate_limited";

/**
 * Prüft das eingegebene Passwort. Der Versuch wird verbucht, bevor
 * verglichen wird, und danach nochmals gezählt — so bleibt das Limit auch
 * bei vielen gleichzeitigen Versuchen hart. Gesperrte Versuche werden
 * nicht verbucht, sonst verlängerte ein Angreifer die Sperre laufend.
 * Nach einem Erfolg zählen frühere Vertipper dieser IP nicht mehr.
 *
 * Verglichen werden HMACs statt der Klartexte: gleich lang, damit die Länge
 * des Passworts nicht über die Laufzeit erkennbar wird.
 */
export async function checkAdminPassword(input: string, ip: string): Promise<LoginResult> {
  const expected = getAdminPassword();
  const ipHash = await hmacWithSessionSecret(ip);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const [fromIp, total] = await Promise.all([
    prisma.loginAttempt.count({ where: { createdAt: { gte: since }, ipHash } }),
    prisma.loginAttempt.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (fromIp >= RATE_LIMIT_MAX_PER_IP || total >= RATE_LIMIT_MAX_TOTAL) {
    return "rate_limited";
  }

  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: since } } });
  await prisma.loginAttempt.create({ data: { ipHash } });
  const counted = await prisma.loginAttempt.count({
    where: { createdAt: { gte: since }, ipHash },
  });
  if (counted > RATE_LIMIT_MAX_PER_IP) return "rate_limited";

  const [given, wanted] = await Promise.all([
    hmacWithSessionSecret(input),
    hmacWithSessionSecret(expected),
  ]);
  if (!constantTimeEqual(given, wanted)) return "invalid";

  await prisma.loginAttempt.deleteMany({ where: { ipHash } });
  return "ok";
}
