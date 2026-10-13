import Link from "next/link";
import { notFound } from "next/navigation";
import EntrySheet from "@/components/EntrySheet";
import { loadSheet } from "@/lib/entries";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { loadRanking } from "@/lib/rankingData";
import { setMarkAsOrganizer } from "../../erfassung/actions";
import DeletePlayerButton from "./DeletePlayerButton";

export const dynamic = "force-dynamic";

function dayOf(date: Date) {
  return date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

// Seite eines Spielers im Spieler-Tab (SPEC.md Abschnitt 6): seine
// Achievements pro Abend — umschaltbar und bearbeitbar wie in der
// Erfassung. Die Stammdaten werden direkt in der Tabelle bearbeitet.
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

  function eveningTab(e: (typeof evenings)[number]) {
    const points = e.seasonRound ? row?.rounds[e.seasonRound - 1]?.points : null;
    const label = e.seasonRound
      ? `R${e.seasonRound}`
      : e.entryClosedAt
        ? "Testabend"
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
          <p className="text-base opacity-70">Noch an keinem Liga-Abend dabei.</p>
        ) : (
          <>
            <nav aria-label="Abend" className="flex flex-wrap gap-2">
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
            {selected && sheet && (
              <div className="max-w-2xl">
                <p className="mb-4 text-base opacity-70">
                  {selected.entryClosedAt
                    ? "Erfassung geschlossen — Änderungen wirken sofort auf die Rangliste."
                    : "Erfassung noch offen."}
                </p>
                <EntrySheet
                  key={selected.id}
                  sheet={sheet}
                  locked={false}
                  onSetMark={setMarkAsOrganizer.bind(null, selected.id, playerId)}
                />
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
