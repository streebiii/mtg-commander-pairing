import Link from "next/link";
import { notFound } from "next/navigation";
import EntrySheet from "@/components/EntrySheet";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { findOpenEvening, loadSheet } from "@/lib/entries";
import { confirmEntry, reopenEntry, setMarkAsOrganizer } from "../actions";

export const dynamic = "force-dynamic";

// Erfassungsblatt eines Spielers aus Sicht des Organisators — zum
// Korrigieren und zum Abtippen von Papierzetteln (siehe SPEC.md
// Abschnitt 12). Gleiches Blatt wie beim Spieler, aber nie gesperrt.
export default async function OrganizerEntryPage({
  params,
}: PageProps<"/admin/erfassung/[playerId]">) {
  const { playerId } = await params;
  const evening = await findOpenEvening();
  if (!evening) notFound();

  const [player, entry, sheet] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerEntry.findUnique({
      where: { eveningId_playerId: { eveningId: evening.id, playerId } },
    }),
    loadSheet(evening.id, playerId),
  ]);
  if (!player || sheet.gamesPlayed.length === 0) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/erfassung" className="text-xs opacity-70 hover:underline">
          ← Zur Übersicht
        </Link>
        <h1 className="text-xl font-semibold">{formatPlayerName(player)}</h1>
        <p className="text-sm opacity-70">
          {entry?.submittedAt
            ? "Abgegeben — du kannst trotzdem korrigieren."
            : entry?.deviceTokenHash
              ? "Erfasst gerade selbst auf dem Handy."
              : "Noch nicht angemeldet — du kannst für ihn erfassen."}
        </p>
      </div>

      <EntrySheet
        sheet={sheet}
        locked={false}
        onSetMark={setMarkAsOrganizer.bind(null, evening.id, playerId)}
      />

      {entry?.submittedAt ? (
        <form action={reopenEntry.bind(null, entry.id)}>
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Abgabe wieder öffnen
          </button>
        </form>
      ) : (
        <form action={confirmEntry.bind(null, evening.id, playerId)}>
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Als abgegeben markieren
          </button>
        </form>
      )}
    </div>
  );
}
