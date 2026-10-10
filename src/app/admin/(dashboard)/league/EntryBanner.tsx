import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { findOpenEvening } from "@/lib/entries";

/**
 * Hinweis auf die offene Achievement-Erfassung im Liga-Tab — auch nach
 * «Abend beenden», bis die Erfassung geschlossen ist (siehe SPEC.md
 * Abschnitt 12).
 */
export default async function EntryBanner() {
  const evening = await findOpenEvening();
  if (!evening) return null;

  const [attendees, submitted] = await Promise.all([
    prisma.tableAssignment.findMany({
      where: {
        table: { round: { eveningId: evening.id, publishedAt: { not: null } } },
      },
      distinct: ["playerId"],
      select: { playerId: true },
    }),
    prisma.playerEntry.count({
      where: { eveningId: evening.id, submittedAt: { not: null } },
    }),
  ]);

  return (
    <section className="flex flex-col gap-2 rounded border border-white/20 p-4">
      <h2 className="text-sm font-medium">Achievement-Erfassung offen</h2>
      <p className="text-sm opacity-70">
        <span className="font-medium tabular-nums opacity-100">
          {submitted} von {attendees.length}
        </span>{" "}
        haben abgegeben.
        {evening.finishedAt && " Der Abend ist beendet — schliesse die Erfassung, wenn alle abgegeben haben."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/erfassung"
          className="inline-flex min-h-11 items-center rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Zur Erfassung
        </Link>
        <Link
          href="/admin/erfassung/tischkarten"
          className="inline-flex min-h-11 items-center rounded border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5"
        >
          Tischkarten drucken
        </Link>
      </div>
    </section>
  );
}
