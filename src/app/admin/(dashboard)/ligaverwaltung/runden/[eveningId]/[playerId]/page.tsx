import Link from "next/link";
import { notFound } from "next/navigation";
import EntrySheet from "@/components/EntrySheet";
import { loadSheet } from "@/lib/entries";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { eveningLabel } from "@/lib/season";
import { confirmEntry, setMarkAsOrganizer } from "../../../actions";

export const dynamic = "force-dynamic";

// Ein Blatt aus Sicht des Organisators (SPEC.md Abschnitt 12.3 und 14):
// zum Korrigieren und zum Abtippen von Papierzetteln. Gleiches Blatt wie
// beim Spieler, aber nie gesperrt — auch nicht in geschlossenen Runden.
// Korrigieren kann nur der Organisator; die Spieler ändern ihr Blatt selbst,
// solange die Erfassung offen ist.
export default async function CorrectEntryPage({
  params,
}: PageProps<"/admin/ligaverwaltung/runden/[eveningId]/[playerId]">) {
  const { eveningId, playerId } = await params;

  const [evening, player, entry] = await Promise.all([
    prisma.evening.findUnique({ where: { id: eveningId } }),
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.playerEntry.findUnique({
      where: { eveningId_playerId: { eveningId, playerId } },
    }),
  ]);
  if (!evening || !player) notFound();
  const sheet = await loadSheet(eveningId, playerId);
  if (sheet.gamesPlayed.length === 0) notFound();

  const title = evening.seasonRound ? `Runde ${evening.seasonRound}` : eveningLabel(evening.date);
  const open = evening.entryClosedAt === null;

  return (
    // Volle Breite wie die übrigen Seiten der Ligaverwaltung: Pro Match und
    // Ganze Runde stehen ab lg nebeneinander (EntrySheet), die Beschreibungen
    // brauchen den Platz.
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/admin/ligaverwaltung/runden/${evening.id}`}
          className="w-fit text-base opacity-70 hover:underline"
        >
          ← {title}
        </Link>
        <h2 className="text-lg font-medium">{formatPlayerName(player)}</h2>
        <p className="text-base opacity-70">
          {!open
            ? "Erfassung geschlossen — Änderungen wirken sofort auf die Rangliste."
            : entry?.submittedAt
              ? "Abgegeben."
              : entry?.deviceTokenHash
                ? "Erfasst gerade selbst auf dem Handy."
                : "Nicht angemeldet — hier z.B. einen Papierzettel erfassen."}
        </p>
      </div>

      <EntrySheet
        sheet={sheet}
        locked={false}
        onSetMark={setMarkAsOrganizer.bind(null, evening.id, playerId)}
      />

      {open && !entry?.submittedAt && (
        <form action={confirmEntry.bind(null, evening.id, playerId)}>
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded bg-foreground px-4 py-2 text-base font-medium text-background hover:opacity-90 sm:w-fit"
          >
            Als abgegeben markieren
          </button>
        </form>
      )}
    </div>
  );
}
