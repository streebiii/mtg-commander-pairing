import Link from "next/link";
import { notFound } from "next/navigation";
import TableCard from "@/components/TableCard";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  formatPoints,
  isRepeatable,
  SCOPE_LABELS,
} from "@/lib/achievements";
import { loadEveningOverview } from "@/lib/entries";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { eveningLabel } from "@/lib/season";

export const dynamic = "force-dynamic";

function dayOf(date: Date) {
  return date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

// Eine Runde (ein Liga-Abend) in der Ligaverwaltung (SPEC.md Abschnitt 14):
// die Teilnehmenden mit ihren Punkten, die Tische und Sieger von Match 1
// und 2 und die Achievements, die an diesem Abend galten. Korrigieren kann
// der Organisator jedes Blatt — auch in geschlossenen Runden.
export default async function RoundDetailPage({
  params,
}: PageProps<"/admin/ligaverwaltung/runden/[eveningId]">) {
  const { eveningId } = await params;
  const evening = await prisma.evening.findUnique({
    where: { id: eveningId },
    include: {
      achievements: true,
      rounds: {
        where: { publishedAt: { not: null } },
        orderBy: { number: "asc" },
        include: {
          tables: {
            orderBy: { tableNumber: "asc" },
            include: {
              assignments: {
                include: { player: true },
                orderBy: [{ player: { firstName: "asc" } }, { player: { lastName: "asc" } }],
              },
            },
          },
        },
      },
    },
  });
  if (!evening) notFound();

  const { rows } = await loadEveningOverview(evening.id);
  const title = evening.seasonRound ? `Runde ${evening.seasonRound}` : eveningLabel(evening.date);
  const status = !evening.finishedAt
    ? "läuft"
    : !evening.entryClosedAt
      ? "Erfassung offen"
      : evening.seasonRound
        ? "geschlossen"
        : "geschlossen · zählt nicht (Testrunde)";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/admin/ligaverwaltung/runden" className="w-fit text-base opacity-70 hover:underline">
          ← Alle Runden
        </Link>
        <h2 className="text-lg font-medium">
          {title} · {dayOf(evening.date)}
        </h2>
        <p className="text-base">{status}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Teilnehmende ({rows.length})</h2>
        <div className="w-full max-w-3xl overflow-x-auto rounded border border-white/10">
          <table className="w-full min-w-[480px] border-separate border-spacing-0 text-base">
            <thead className="text-left">
              <tr>
                <th className="border-b border-white/10 px-3 py-2.5">Spieler</th>
                <th className="border-b border-white/10 px-3 py-2.5">Matches</th>
                <th className="border-b border-white/10 px-3 py-2.5 text-right">Punkte</th>
                <th className="border-b border-white/10 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => b.total - a.total)
                .map((r) => (
                  <tr key={r.playerId} className="hover:bg-surface">
                    <td className="border-b border-white/5 px-3 py-2.5 font-medium">
                      {formatPlayerName(r.name)}
                    </td>
                    <td className="border-b border-white/5 px-3 py-2.5 tabular-nums">
                      {r.games.join(", ")}
                    </td>
                    <td className="border-b border-white/5 px-3 py-2.5 text-right font-medium tabular-nums">
                      {r.total}
                    </td>
                    <td className="border-b border-white/5 px-3 py-0.5 text-right">
                      <Link
                        href={`/admin/ligaverwaltung/runden/${evening.id}/${r.playerId}`}
                        className="inline-flex min-h-11 items-center rounded px-2 hover:bg-white/10"
                      >
                        Korrigieren ›
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {evening.rounds.length === 0 ? (
        <p className="text-base opacity-70">
          Keine Tische — diese Runde wurde aus den Punkteblättern nachgetragen.
        </p>
      ) : (
        evening.rounds.map((round) => (
          <section key={round.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Match {round.number}</h2>
            <div className="flex flex-wrap gap-4">
              {round.tables.map((table) => (
                <TableCard
                  key={table.id}
                  tableNumber={table.tableNumber}
                  size={table.size}
                  aside={
                    table.resultEnteredAt && !table.assignments.some((a) => a.isWinner) ? (
                      <span className="opacity-70">unentschieden</span>
                    ) : undefined
                  }
                >
                  <ul className="flex flex-col gap-2">
                    {table.assignments.map((a) => (
                      <li key={a.id} className="flex min-h-9 items-center gap-2 text-base">
                        <span className="w-5 shrink-0" aria-hidden="true">
                          {a.isWinner ? "🏆" : ""}
                        </span>
                        <span className={`truncate ${a.droppedAt ? "line-through opacity-60" : ""}`}>
                          {formatPlayerName(a.player)}
                        </span>
                        {a.droppedAt && <span className="shrink-0 opacity-70">gedroppt</span>}
                      </li>
                    ))}
                  </ul>
                </TableCard>
              ))}
            </div>
          </section>
        ))
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Achievements dieser Runde ({evening.achievements.length})</h2>
        <div className="grid max-w-5xl gap-6 md:grid-cols-3">
          {CATEGORIES.map((category) => {
            const list = evening.achievements
              .filter((a) => a.category === category)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            if (list.length === 0) return null;
            return (
              <div key={category} className="flex flex-col gap-2">
                <h3 className="text-base font-medium opacity-70">{CATEGORY_LABELS[category]}</h3>
                <ul className="flex flex-col gap-1.5 text-base">
                  {list.map((a) => (
                    <li key={a.id} className="flex gap-2">
                      <span className="w-10 shrink-0 tabular-nums opacity-70">{formatPoints(a.points)}</span>
                      <span>
                        {a.title}
                        {(isRepeatable(a.scope) || a.scope === "SEASON") && (
                          <span className="opacity-60"> ({SCOPE_LABELS[a.scope]})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
