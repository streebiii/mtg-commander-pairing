/**
 * Basis-URL der Anwendung für absolute Links (z.B. im Login-Link-Email).
 * Auf Vercel ist VERCEL_URL automatisch gesetzt; APP_URL erlaubt eine
 * explizite Override (z.B. für eine eigene Domain). Lokal: localhost.
 */
export function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
