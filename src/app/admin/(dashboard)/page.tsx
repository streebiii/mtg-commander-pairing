import Link from "next/link";
import type { ReactNode } from "react";
import { getCasualPairing } from "@/lib/casualPairing";
import { findOpenEvening } from "@/lib/entries";
import { MAX_ROUNDS } from "@/lib/pairing/leagueAssignment";
import { prisma } from "@/lib/prisma";
import { eveningLabel } from "@/lib/season";

export const dynamic = "force-dynamic";

/** Eine Kachel der Übersicht: Titel, Stand und ein Link dorthin. */
function Card({
  title,
  href,
  action,
  warn = false,
  children,
}: {
  title: string;
  href: string;
  action: string;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        warn ? "border-amber-500/60 bg-amber-500/5" : "border-white/10 bg-surface"
      }`}
    >
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="flex-1 text-base">{children}</div>
      <Link
        href={href}
        className="inline-flex min-h-11 w-fit items-center underline-offset-2 hover:underline"
      >
        {action} ›
      </Link>
    </section>
  );
}

// Dashboard (SPEC.md Abschnitt 2): was gerade los ist — laufende Runde,
// Achievement-Erfassung, ob die rotierenden Achievements für die nächste
// Runde stimmen, und ob eine Casual-Zuteilung steht. Jeweils mit Link
// dorthin, wo man es bearbeitet.
export default async function AdminDashboard() {
  const [running, openEntry, casual, activeRotating, totalRotating] = await Promise.all([
    prisma.evening.findFirst({
      where: { finishedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        rounds: {
          orderBy: { number: "desc" },
          take: 1,
          include: { tables: { select: { resultEnteredAt: true } } },
        },
      },
    }),
    findOpenEvening(),
    getCasualPairing(),
    prisma.achievement.count({ where: { category: "ROTATING", active: true } }),
    prisma.achievement.count({ where: { category: "ROTATING" } }),
  ]);

  const [submitted, attendees] = openEntry
    ? await Promise.all([
        prisma.playerEntry.count({
          where: { eveningId: openEntry.id, submittedAt: { not: null } },
        }),
        prisma.tableAssignment.findMany({
          where: { table: { round: { eveningId: openEntry.id, publishedAt: { not: null } } } },
          distinct: ["playerId"],
          select: { playerId: true },
        }),
      ])
    : [0, []];

  const match = running?.rounds[0];
  const openTables = match?.tables.filter((t) => t.resultEnteredAt === null).length ?? 0;
  const rotatingOk = activeRotating === 10;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {running && match ? (
          <Card title={`${eveningLabel(running.date)} läuft`} href="/admin/league" action="Zum Liga-Tab">
            Match {match.number} von {MAX_ROUNDS} ·{" "}
            {!match.publishedAt
              ? "im Warteraum"
              : openTables === 0
                ? "alle Tische erfasst"
                : `${openTables} Tische offen`}
          </Card>
        ) : (
          <Card
            title="Rotierende Achievements"
            href="/admin/ligaverwaltung/achievements"
            action="Prüfen"
            warn={!rotatingOk}
          >
            <span className="font-medium tabular-nums">
              {activeRotating} von {totalRotating} aktiv
            </span>
            {!rotatingOk && " — für die nächste Runde sollten genau 10 aktiv sein."}
          </Card>
        )}

        {openEntry && (
          <Card title="Achievement-Erfassung" href="/admin/ligaverwaltung" action="Zur Ligaverwaltung">
            <span className="font-medium tabular-nums">
              {submitted} von {attendees.length}
            </span>{" "}
            haben abgegeben
            {openEntry.finishedAt && " · Runde beendet, Erfassung noch offen"}
          </Card>
        )}

        <Card title="Casual" href="/admin/casual" action="Zum Casual-Tab">
          {casual
            ? `${casual.tables.length} Tische · ${casual.published ? "live" : "im Warteraum"}`
            : "Keine Zuteilung"}
        </Card>

        <Card title="Öffentlich" href="/" action="Pairing-Ansicht">
          Pairings und{" "}
          <Link href="/rangliste" className="underline-offset-2 hover:underline">
            Rangliste
          </Link>{" "}
          ohne Login
        </Card>
      </div>
    </div>
  );
}
