"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { createLoginToken, isRateLimited } from "@/lib/loginToken";
import { sendLoginLinkEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";

/**
 * Fordert einen neuen Login-Link an: erzeugt einen Einmal-Token und
 * verschickt ihn per Email an die fest konfigurierte ADMIN_EMAIL-Adresse
 * (siehe SPEC.md Abschnitt 2). Kein Passwort mehr — die Email-Zustellung
 * selbst ist der einzige Faktor.
 */
export async function requestLoginLink(formData: FormData) {
  const next = String(formData.get("next") ?? "/admin");

  if (await isRateLimited()) {
    redirect(
      `/admin/login?next=${encodeURIComponent(next)}&error=rate_limited`,
    );
  }

  let sendFailed = false;
  try {
    const rawToken = await createLoginToken();
    const link = `${getBaseUrl()}/admin/verify?token=${rawToken}&next=${encodeURIComponent(next)}`;
    await sendLoginLinkEmail(link);
  } catch (err) {
    console.error("Login-Link konnte nicht verschickt werden:", err);
    sendFailed = true;
  }

  if (sendFailed) {
    redirect(`/admin/login?next=${encodeURIComponent(next)}&error=send_failed`);
  }
  redirect(`/admin/login?next=${encodeURIComponent(next)}&sent=1`);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
