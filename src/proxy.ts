import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Schützt den kompletten /admin-Bereich mit dem Session-Cookie, das nach
// erfolgreichem Email-Login gesetzt wird. Die öffentliche Lese-Ansicht
// ("/") bleibt bewusst ungeschützt (siehe SPEC.md Abschnitt 2).
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

  return NextResponse.next();
}

export const config = {
  // /api/admin/** enthält alle Organisator-only-API-Routen (z.B. Modus-A/B-
  // Pairing-Berechnung). Öffentliche APIs (z.B. für die Lese-Ansicht) liegen
  // bewusst außerhalb dieses Präfixes.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
