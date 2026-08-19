import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import { consumeLoginToken } from "@/lib/loginToken";

/**
 * Ziel des Links aus der Login-Email. Löst den Einmal-Token ein und setzt
 * bei Erfolg das Session-Cookie (siehe SPEC.md Abschnitt 2).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/admin";
  const next = nextParam.startsWith("/admin") ? nextParam : "/admin";

  const valid = await consumeLoginToken(token);
  if (!valid) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("error", "invalid_token");
    return NextResponse.redirect(loginUrl);
  }

  const sessionToken = await createSessionToken();
  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  return response;
}
