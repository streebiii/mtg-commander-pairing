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

  // /admin/login (Link anfordern) und /admin/verify (Link einlösen) sind
  // der Login-Mechanismus selbst — hier ist naturgemäß noch keine Session
  // vorhanden.
  if (pathname === "/admin/login" || pathname === "/admin/verify") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionToken(token);

  if (!isValid) {
    // API-Routen bekommen eine 401-JSON-Antwort statt eines Redirects,
    // alles andere (Seiten unter /admin) wird zum Login geschickt.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
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

export const config = {
  // /api/admin/** enthält alle Organisator-only-API-Routen (z.B. Modus-A/B-
  // Pairing-Berechnung). Öffentliche APIs (z.B. für die Lese-Ansicht) liegen
  // bewusst außerhalb dieses Präfixes.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
