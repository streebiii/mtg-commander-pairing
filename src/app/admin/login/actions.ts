"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import { consumeLoginCode, createLoginCode, isRateLimited } from "@/lib/loginToken";
import { sendLoginCodeEmail } from "@/lib/email";

/** Nur Ziele innerhalb des Organisator-Bereichs zulassen (kein Open Redirect). */
function safeNext(value: unknown): string {
  const next = String(value ?? "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

/**
 * Fordert einen neuen Login-Code an: erzeugt einen sechsstelligen
 * Einmal-Code und verschickt ihn per Email an die fest konfigurierte
 * ADMIN_EMAIL-Adresse (siehe SPEC.md Abschnitt 2). Kein Passwort — die
 * Email-Zustellung selbst ist der einzige Faktor.
 */
export async function requestLoginCode(formData: FormData) {
  const next = safeNext(formData.get("next"));

  if (await isRateLimited()) {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=rate_limited`);
  }

  let sendFailed = false;
  try {
    const code = await createLoginCode();
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
  const result = await consumeLoginCode(String(formData.get("code") ?? ""));

  if (result !== "ok") {
    const error = result === "too_many_attempts" ? "too_many_attempts" : "invalid_code";
    redirect(
      `/admin/login?next=${encodeURIComponent(next)}&step=code&error=${error}`,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken(), SESSION_COOKIE_OPTIONS);
  redirect(next);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
