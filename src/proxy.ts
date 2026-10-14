import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

/**
 * Content-Security-Policy mit einem Nonce pro Anfrage. Skripte laufen nur,
 * wenn Next.js sie mit diesem Nonce ausgezeichnet hat — ein eingeschleustes
 * `<script>` oder ein `onclick="…"` bleibt wirkungslos. Next liest den
 * Nonce beim Rendern aus dem CSP-Header der Anfrage; das klappt nur bei
 * dynamisch gerenderten Seiten, was hier für alle Seiten gilt
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 *
 * Styles bewusst ohne Nonce, aber mit 'unsafe-inline': React-`style`-
 * Attribute und next/image brauchen das, und ein Nonce würde
 * 'unsafe-inline' im Browser abschalten. Eingeschleustes CSS kann keinen
 * Code ausführen.
 */
function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React braucht 'unsafe-eval' nur im Dev-Modus (Fehler-Stacks).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// Zwei Aufgaben: setzt auf jeder Seite die Content-Security-Policy und
// schützt den kompletten /admin-Bereich mit dem Session-Cookie, das nach
// erfolgreichem Email-Login gesetzt wird. Die öffentlichen Seiten bleiben
// bewusst ohne Login (siehe SPEC.md Abschnitt 2).
//
// Bei jedem gültigen Aufruf im /admin-Bereich wird das Cookie frisch
// ausgestellt — die Gültigkeit ist dadurch gleitend und läuft immer ab der
// letzten Nutzung (siehe SESSION_MAX_AGE_SECONDS in src/lib/auth.ts). Ein
// durchgehend genutzter Spielabend kann damit beliebig lang sein.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login ist der Login-Mechanismus selbst (Code anfordern und
  // eingeben) — hier ist naturgemäss noch keine Session vorhanden.
  const needsSession =
    (pathname === "/admin" || pathname.startsWith("/admin/")) &&
    pathname !== "/admin/login";

  if (needsSession) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!(await verifySessionToken(token))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  if (needsSession) {
    // Gültige Sitzung: Cookie neu ausstellen, damit die Frist ab jetzt neu
    // läuft. Das Signieren ist ein HMAC über wenige Bytes und fällt gegenüber
    // dem Rendern der Seite nicht ins Gewicht.
    response.cookies.set(
      SESSION_COOKIE_NAME,
      await createSessionToken(),
      SESSION_COOKIE_OPTIONS,
    );
  }
  return response;
}

// Alles ausser statischen Dateien. Prefetch-Anfragen bleiben bewusst drin:
// auch sie liefern Seiteninhalt, im /admin-Bereich also nur mit Login.
//
// Server Actions schützt der Proxy nicht zuverlässig — jede Organisator-
// Action prüft die Anmeldung deshalb zusätzlich selbst (siehe
// src/lib/adminGuard.ts).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)",
  ],
};
