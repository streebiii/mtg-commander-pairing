"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import {
  consumeLoginCode,
  createLoginCode,
  isRateLimited,
  newBrowserId,
} from "@/lib/loginToken";
import { sendLoginCodeEmail } from "@/lib/email";

/** Nur Ziele innerhalb des Organisator-Bereichs zulassen (kein Open Redirect). */
function safeNext(value: unknown): string {
  const next = String(value ?? "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

/**
 * Cookie, an das ein angeforderter Code gebunden wird: einlösen lässt er
 * sich nur aus dem Browser, der ihn angefordert hat (siehe
 * src/lib/loginToken.ts).
 */
const LOGIN_BROWSER_COOKIE = "admin_login_browser";

/**
 * IP des Aufrufers. Auf Vercel setzt die Plattform `x-real-ip` und
 * `x-forwarded-for` selbst und überschreibt, was der Client mitschickt.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unbekannt"
  );
}

/**
 * Fordert einen neuen Login-Code an: erzeugt einen sechsstelligen
 * Einmal-Code und verschickt ihn per Email an die fest konfigurierte
 * ADMIN_EMAIL-Adresse (siehe SPEC.md Abschnitt 2). Kein Passwort — die
 * Email-Zustellung selbst ist der einzige Faktor.
 */
export async function requestLoginCode(formData: FormData) {
  const next = safeNext(formData.get("next"));

  const ip = await clientIp();
  if (await isRateLimited(ip)) {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=rate_limited`);
  }

  // Bestehendes Cookie weiterverwenden, damit auch ein zweiter angeforderter
  // Code aus demselben Browser einlösbar bleibt.
  const cookieStore = await cookies();
  const browserId = cookieStore.get(LOGIN_BROWSER_COOKIE)?.value ?? newBrowserId();
  cookieStore.set(LOGIN_BROWSER_COOKIE, browserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // deckt die 10 Minuten Gültigkeit der Codes reichlich ab
  });

  let sendFailed = false;
  try {
    const code = await createLoginCode(browserId, ip);
    await sendLoginCodeEmail(code);
  } catch (err) {
    console.error("Login-Code konnte nicht verschickt werden:", err);
    sendFailed = true;
  }

  if (sendFailed) {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=send_failed`);
  }
  // step=code schaltet die Eingabemaske frei.
  redirect(`/admin/login?next=${encodeURIComponent(next)}&step=code`);
}

/**
 * Löst den eingegebenen Code ein und setzt bei Erfolg das Session-Cookie.
 * Die Eingabemaske bleibt bei Fehlern offen, damit man es direkt nochmal
 * versuchen kann, ohne einen neuen Code anzufordern.
 */
export async function submitLoginCode(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const cookieStore = await cookies();
  const result = await consumeLoginCode(
    String(formData.get("code") ?? ""),
    cookieStore.get(LOGIN_BROWSER_COOKIE)?.value,
  );

  if (result !== "ok") {
    const error = result === "too_many_attempts" ? "too_many_attempts" : "invalid_code";
    redirect(
      `/admin/login?next=${encodeURIComponent(next)}&step=code&error=${error}`,
    );
  }

  cookieStore.delete(LOGIN_BROWSER_COOKIE);
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(), SESSION_COOKIE_OPTIONS);
  redirect(next);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
