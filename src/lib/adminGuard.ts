import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

/**
 * Prüft in einer Server Action, dass der Organisator angemeldet ist.
 *
 * Der Proxy schützt nur Aufrufe unter /admin. Server Actions lassen sich
 * aber per direktem POST auch über andere Pfade auslösen — die Next-Doku
 * verlangt deshalb ausdrücklich eine Prüfung in jeder Action
 * (node_modules/next/dist/docs/01-app/02-guides/data-security.md).
 */
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!(await verifySessionToken(token))) {
    throw new Error("Nicht angemeldet");
  }
}
