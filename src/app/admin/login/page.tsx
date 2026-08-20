import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { requestLoginCode } from "./actions";
import CodeForm from "./CodeForm";
import SubmitButton from "./SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited:
    "Zu viele Code-Anfragen. Bitte warte 10 Minuten und versuch es erneut.",
  send_failed:
    "Der Login-Code konnte nicht verschickt werden. Bitte später erneut versuchen.",
  invalid_code: "Dieser Code stimmt nicht. Bitte prüfe die Email und versuch es erneut.",
  too_many_attempts:
    "Zu viele Fehlversuche — dieser Code ist gesperrt. Fordere einen neuen an.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; step?: string }>;
}) {
  const { next, error, step } = await searchParams;
  const target = next?.startsWith("/admin") ? next : "/admin";

  // Wer schon eine gültige Sitzung hat, soll hier gar nicht landen — und
  // vor allem keine überflüssige Email auslösen.
  const cookieStore = await cookies();
  if (await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)) {
    redirect(target);
  }

  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Unbekannter Fehler.") : null;
  const awaitingCode = step === "code";

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-8 px-4">
      <h1 className="text-xl font-semibold">Organisator-Login</h1>

      {awaitingCode ? (
        <>
          <p className="text-sm opacity-70">
            Wir haben dir einen sechsstelligen Code geschickt. Er ist 10
            Minuten gültig.
          </p>
          <CodeForm next={target} />
          <form action={requestLoginCode}>
            <input type="hidden" name="next" value={target} />
            <button
              type="submit"
              className="flex min-h-11 items-center text-sm underline opacity-70"
            >
              Neuen Code anfordern
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm opacity-70">
            Kein Passwort nötig — fordere einen Code per Email an und gib ihn
            hier ein.
          </p>
          <form action={requestLoginCode} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={target} />
            <SubmitButton />
          </form>
        </>
      )}

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
