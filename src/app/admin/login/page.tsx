import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-xl font-semibold">Organisator-Login</h1>
      <form action={loginAction} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            name="password"
            autoFocus
            required
            className="rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600">Falsches Passwort.</p>
        )}
        <button
          type="submit"
          className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          Anmelden
        </button>
      </form>
    </div>
  );
}
