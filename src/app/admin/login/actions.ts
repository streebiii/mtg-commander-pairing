"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";
import { checkAdminPassword } from "@/lib/adminLogin";

/** Nur Ziele innerhalb des Organisator-Bereichs zulassen (kein Open Redirect). */
function safeNext(value: unknown): string {
  const next = String(value ?? "/admin");
  return next.startsWith("/admin") ? next : "/admin";
}

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
 * Prüft das Organisator-Passwort (ADMIN_PASSWORD, siehe SPEC.md
 * Abschnitt 2) und setzt bei Erfolg das Session-Cookie.
 */
export async function submitPassword(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const result = await checkAdminPassword(String(formData.get("password") ?? ""), await clientIp());

  if (result !== "ok") {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=${result}`);
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
