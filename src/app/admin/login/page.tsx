import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { submitPassword } from "./actions";
import SubmitButton from "./SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Dieses Passwort stimmt nicht.",
  rate_limited: "Zu viele Fehlversuche. Bitte warte 10 Minuten und versuch es erneut.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin";

  // Wer schon eine gültige Sitzung hat, soll hier gar nicht landen.
  const cookieStore = await cookies();
  if (await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)) {
    redirect(target);
  }

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Unbekannter Fehler.") : null;

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-8 px-4">
      <h1 className="text-xl font-semibold">Organisator-Login</h1>

      <form action={submitPassword} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={target} />
        <label className="flex flex-col gap-2 text-base">
          Passwort
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="min-h-11 w-full rounded border border-white/20 px-3 py-2 text-base"
          />
        </label>
        <SubmitButton />
      </form>

      {errorMessage && <p className="text-base text-red-600">{errorMessage}</p>}
    </div>
  );
}
