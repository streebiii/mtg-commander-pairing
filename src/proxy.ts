import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth";

// Schützt den kompletten /admin-Bereich mit dem Session-Cookie, das nach
// erfolgreichem Email-Login gesetzt wird. Die öffentliche Lese-Ansicht
// ("/") bleibt bewusst ungeschützt (siehe SPEC.md Abschnitt 2).
//
// Bei jedem gültigen Aufruf wird das Cookie frisch ausgestellt — die
// Gültigkeit ist dadurch gleitend und läuft immer ab der letzten Nutzung
// (siehe SESSION_MAX_AGE_SECONDS in src/lib/auth.ts). Ein durchgehend
// genutzter Spielabend kann damit beliebig lang sein.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/login ist der Login-Mechanismus selbst (Code anfordern und
  // eingeben) — hier ist naturgemäss noch keine Session vorhanden.
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Gültige Sitzung: Cookie neu ausstellen, damit die Frist ab jetzt neu
  // läuft. Das Signieren ist ein HMAC über wenige Bytes und fällt gegenüber
  // dem Rendern der Seite nicht ins Gewicht.
  const response = NextResponse.next();
  response.cookies.set(
    SESSION_COOKIE_NAME,
    await createSessionToken(),
    SESSION_COOKIE_OPTIONS,
  );
  return response;
}

// Server Actions schützt der Proxy nicht zuverlässig — jede Organisator-
// Action prüft die Anmeldung deshalb zusätzlich selbst (siehe
// src/lib/adminGuard.ts).
export const config = {
  matcher: ["/admin/:path*"],
};
