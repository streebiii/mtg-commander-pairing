import { requestLoginLink } from "./actions";
import SubmitButton from "./SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited:
    "Zu viele Login-Link-Anfragen. Bitte warte 10 Minuten und versuch es erneut.",
  send_failed:
    "Der Login-Link konnte nicht verschickt werden. Bitte später erneut versuchen.",
  invalid_token:
    "Dieser Login-Link ist ungültig oder abgelaufen. Fordere einen neuen an.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const { next, error, sent } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Unbekannter Fehler.") : null;

  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-8 px-4">
      <h1 className="text-xl font-semibold">Organisator-Login</h1>
      <p className="text-sm opacity-70">
        Kein Passwort mehr nötig — fordere einen Login-Link per Email an und
        klicke ihn an, um dich einzuloggen (10 Minuten gültig).
      </p>

      <form action={requestLoginLink} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <SubmitButton />
      </form>

      {sent && !error && (
        <p className="text-sm text-green-600">
          Email verschickt — prüfe dein Postfach und klicke den Link darin an.
        </p>
      )}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
}
