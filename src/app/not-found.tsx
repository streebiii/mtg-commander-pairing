import Link from "next/link";
import { connection } from "next/server";

// Eigene 404-Seite, bewusst dynamisch gerendert: die Content-Security-
// Policy (src/proxy.ts) erlaubt nur Skripte mit dem Nonce der Anfrage, und
// eine beim Build vorgerenderte Seite hätte keinen.
export default async function NotFound() {
  await connection();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
      <h1 className="text-xl font-semibold">Seite nicht gefunden</h1>
      <p className="text-base opacity-70">Diese Adresse gibt es nicht.</p>
      <Link href="/" className="flex min-h-11 items-center text-base underline">
        Zu den Pairings
      </Link>
    </div>
  );
}
