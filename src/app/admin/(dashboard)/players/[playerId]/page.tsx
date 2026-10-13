import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSheet } from "@/lib/entries";
import { computeBreakdown, marksToMap } from "@/lib/entrySheet";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { loadRanking } from "@/lib/rankingData";
import DeletePlayerButton from "./DeletePlayerButton";

export const dynamic = "force-dynamic";

function dayOf(date: Date) {
  return date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

// Seite eines Spielers im Spieler-Tab (SPEC.md Abschnitt 6): seine
// Achievements pro Runde, nur zum Ansehen — korrigiert wird in der
// Ligaverwaltung (Abschnitt 14). Die Stammdaten werden direkt in der
// Tabelle bearbeitet.
export default async function PlayerPage({
  params,
  searchParams,
}: PageProps<"/admin/players/[playerId]">) {
  const { playerId } = await params;
  const { abend } = await searchParams;

  const [player, evenings, running, ranking] = await Promise.all([
    prisma.player.findFirst({ where: { id: playerId, archivedAt: null } }),
    // Abende, an denen er gespielt oder etwas erfasst hat — auch
    // nachgetragene ohne Tische (SPEC.md Abschnitt 13.3).
    prisma.evening.findMany({
      where: {
        OR: [
          { entries: { some: { playerId } } },
          {
            rounds: {
              some: {
                publishedAt: { not: null },
                tables: { some: { assignments: { some: { playerId } } } },
              },
            },
          },
        ],
      },
      orderBy: { date: "desc" },
      select: { id: true, date: true, seasonRound: true, entryClosedAt: true },
    }),
    prisma.tableAssignment.count({
      where: { playerId, table: { round: { evening: { finishedAt: null } } } },
    }),
    loadRanking(),
  ]);
  if (!player) notFound();

  const row = ranking.rows.find((r) => r.id === playerId);
  const selected = evenings.find((e) => e.id === abend) ?? evenings[0];
  const sheet = selected ? await loadSheet(selected.id, playerId) : null;
  const breakdown = sheet
    ? computeBreakdown(sheet.achievements, marksToMap(sheet.marks), sheet.gamesPlayed, sheet.lastEvening)
    : null;

  function eveningTab(e: (typeof evenings)[number]) {
    const points = e.seasonRound ? row?.rounds[e.seasonRound - 1]?.points : null;
    const label = e.seasonRound
      ? `R${e.seasonRound}`
      : e.entryClosedAt
        ? "Testrunde"
        : "Läuft";
    return { label, points };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/players" className="w-fit text-base opacity-70 hover:underline">
          ← Alle Spieler
        </Link>
        <h1 className="text-xl font-semibold">{formatPlayerName(player)}</h1>
        {row && (
          <p className="text-base opacity-70">
            Rang {row.rank} · {row.total} Punkte in der Saison
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Achievements</h2>
        {evenings.length === 0 ? (
          <p className="text-base opacity-70">Noch an keiner Runde dabei.</p>
        ) : (
          <>
            <nav aria-label="Runde" className="flex flex-wrap gap-2">
              {evenings.map((e) => {
                const { label, points } = eveningTab(e);
                const current = e.id === selected?.id;
                return (
                  <Link
                    key={e.id}
                    href={`/admin/players/${playerId}?abend=${e.id}`}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-base transition-colors ${
                      current
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="opacity-60">{dayOf(e.date)}</span>
                    {points != null && <span className="tabular-nums">· {points}</span>}
                  </Link>
                );
              })}
            </nav>
            {selected && breakdown && (
              <div className="flex max-w-md flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-medium">
                    Total <span className="text-xl font-semibold tabular-nums">{breakdown.total}</span>
                  </span>
                  <Link
                    href={`/admin/ligaverwaltung/runden/${selected.id}/${playerId}`}
                    className="inline-flex min-h-11 items-center rounded px-2 text-base hover:bg-white/10"
                  >
                    Korrigieren ›
                  </Link>
                </div>
                {breakdown.sections.map((section) => (
                  <div key={section.label} className="flex flex-col gap-1">
                    <h3 className="flex justify-between text-base font-medium">
                      <span>{section.label}</span>
                      <span className="tabular-nums">{section.total}</span>
                    </h3>
                    <ul className="flex flex-col gap-1 text-base opacity-80">
                      {section.items.map((item) => (
                        <li key={item.title} className="flex justify-between gap-3">
                          <span>
                            {item.title}
                            {item.count > 1 && <span className="opacity-60"> ×{item.count}</span>}
                          </span>
                          <span className="tabular-nums">{item.points * item.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <div className="border-t border-white/10 pt-6">
        <DeletePlayerButton playerId={player.id} inRunningEvening={running > 0} />
      </div>
    </div>
  );
}
