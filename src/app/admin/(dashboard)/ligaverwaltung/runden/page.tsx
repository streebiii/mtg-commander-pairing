import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { eveningNumber } from "@/lib/season";
import DeleteRoundButton from "./DeleteRoundButton";

export const dynamic = "force-dynamic";

function dayOf(date: Date) {
  return date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

// Reiter «Runden» der Ligaverwaltung (SPEC.md Abschnitt 14): alle Runden
// (Liga-Abende), die neueste zuoberst. Mit einer festen Zahl von Abfragen,
// weil Neon von Vercel aus jede Abfrage einzeln kostet.
export default async function RoundsPage() {
  const [evenings, seats, entries] = await Promise.all([
    prisma.evening.findMany({
      where: { OR: [{ rounds: { some: {} } }, { entries: { some: {} } }] },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        seasonRound: true,
        finishedAt: true,
        entryClosedAt: true,
        _count: { select: { rounds: true } },
      },
    }),
    prisma.tableAssignment.findMany({
      where: { table: { round: { publishedAt: { not: null } } } },
      select: { playerId: true, table: { select: { round: { select: { eveningId: true } } } } },
    }),
    prisma.playerEntry.findMany({
      where: { games: { isEmpty: false } },
      select: { playerId: true, eveningId: true },
    }),
  ]);

  // Teilnehmende je Runde: wer an einem Tisch sass, bei nachgetragenen
  // Runden wer laut Erfassung gespielt hat.
  const players = new Map<string, Set<string>>();
  const add = (eveningId: string, playerId: string) => {
    const set = players.get(eveningId) ?? new Set<string>();
    set.add(playerId);
    players.set(eveningId, set);
  };
  for (const s of seats) add(s.table.round.eveningId, s.playerId);
  for (const e of entries) add(e.eveningId, e.playerId);

  if (evenings.length === 0) {
    return <p className="text-base opacity-70">Noch keine Runden.</p>;
  }

  return (
    <div className="w-full max-w-3xl overflow-x-auto rounded border border-white/10">
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-base">
        <thead className="text-left">
          <tr>
            <th className="border-b border-white/10 px-3 py-2.5">Runde</th>
            <th className="border-b border-white/10 px-3 py-2.5">Datum</th>
            <th className="border-b border-white/10 px-3 py-2.5 text-right">Teilnehmende</th>
            <th className="border-b border-white/10 px-3 py-2.5">Status</th>
            <th className="border-b border-white/10 px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {evenings.map((e) => {
            const status = !e.finishedAt
              ? "läuft"
              : !e.entryClosedAt
                ? "Erfassung offen"
                : e._count.rounds === 0
                  ? "nachgetragen"
                  : "geschlossen";
            return (
              <tr key={e.id} className="hover:bg-surface">
                <td className="border-b border-white/5 px-3 py-2.5 font-medium">
                  {e.seasonRound
                    ? `R${e.seasonRound}`
                    : e.entryClosedAt
                      ? "Testrunde"
                      : `R${eveningNumber(e.date) ?? "?"}`}
                </td>
                <td className="border-b border-white/5 px-3 py-2.5 tabular-nums">{dayOf(e.date)}</td>
                <td className="border-b border-white/5 px-3 py-2.5 text-right tabular-nums">
                  {players.get(e.id)?.size ?? 0}
                </td>
                <td className="border-b border-white/5 px-3 py-2.5">
                  <span className={status === "läuft" || status === "Erfassung offen" ? "text-amber-400" : ""}>
                    {status}
                  </span>
                </td>
                <td className="border-b border-white/5 px-3 py-0.5 text-right">
                  <DeleteRoundButton
                    eveningId={e.id}
                    warning={
                      !e.finishedAt
                        ? "Die Runde läuft gerade — Tische und alle Erfassungen gehen verloren."
                        : !e.entryClosedAt
                          ? "Die Erfassung ist noch offen — alle Einträge der Spieler gehen verloren."
                          : e.seasonRound
                            ? `Sie zählt als R${e.seasonRound} — ihre erfassten Punkte verschwinden aus Rangliste und Paarung.`
                            : null
                    }
                  />
                  <Link
                    href={`/admin/ligaverwaltung/runden/${e.id}`}
                    className="inline-flex min-h-11 items-center rounded px-2 hover:bg-white/10"
                  >
                    Ansehen ›
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
