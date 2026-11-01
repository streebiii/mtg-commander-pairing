import { loadHonors } from "@/lib/honorsData";
import { prisma } from "@/lib/prisma";
import { loadRanking } from "@/lib/rankingData";
import { EVENINGS_PER_SEASON } from "@/lib/season";
import PublishRankingButton from "./PublishRankingButton";

export const dynamic = "force-dynamic";

// Reiter «Endstand» der Ligaverwaltung (SPEC.md Abschnitte 13.5 und 15):
// zum Vorlesen bei der Rangverkündigung die ersten Plätze, die ganze
// Rangliste und die Ehrungen. Nur für den Organisator, darum auch mit einem
// Finale, das noch nicht öffentlich ist. Rechnet bei jedem Aufruf neu.
export default async function EndstandPage() {
  const [{ rounds, groups, entryOpen }, { rows }, held] = await Promise.all([
    loadHonors(),
    loadRanking(),
    prisma.evening.findFirst({
      where: {
        pairByPoints: true,
        entryClosedAt: { not: null },
        seasonRound: { not: null },
        rankingPublishedAt: null,
      },
      orderBy: { date: "desc" },
      select: { id: true },
    }),
  ]);
  const missing = EVENINGS_PER_SEASON - rounds.length;
  const top = rows.filter((r) => r.rank <= 3 && r.total > 0);
  // Ehrungen ohne Geehrte fallen weg, Themen ohne Ehrung ebenso.
  const shown = groups
    .map((g) => ({ ...g, honors: g.honors.filter((h) => h.winners.length > 0) }))
    .filter((g) => g.honors.length > 0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <p className="text-base opacity-70">
        {rounds.length === 0
          ? "Noch keine geschlossene Runde — der Stand füllt sich, sobald eine Erfassung geschlossen ist."
          : `Gezählt: ${rounds.map((r) => `R${r}`).join(", ")}.`}{" "}
        {entryOpen
          ? "Eine Erfassung ist noch offen; ihre Runde zählt erst nach dem Schliessen."
          : missing > 0
            ? `Noch ${missing === 1 ? "eine Runde" : `${missing} Runden`} bis zum Saisonende.`
            : "Die Saison ist vollständig."}
      </p>

      {held && (
        <div className="flex flex-col items-start gap-3 rounded border border-yellow-400/40 bg-yellow-400/10 p-4">
          <p className="text-base">
            Das Finale ist noch nicht öffentlich: diesen Stand siehst nur du.
          </p>
          <PublishRankingButton eveningId={held.id} />
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{missing > 0 ? "Zwischenstand" : "Endstand"}</h2>
        <ol className="flex flex-col">
          {top.map((r) => (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-6 border-t border-white/10 py-2"
            >
              <span className="text-xl font-semibold">
                {r.rank}. {r.name}
              </span>
              <span className="text-xl font-semibold tabular-nums">{r.total}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Rangliste</h2>
        <ol className="flex flex-col">
          {rows
            .filter((r) => !top.includes(r))
            .map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-6 border-t border-white/10 py-2"
              >
                <span>
                  {r.rank}. {r.name}
                </span>
                <span className="tabular-nums">{r.total}</span>
              </li>
            ))}
        </ol>
      </section>

      <h2 className="text-xl font-semibold">Ehrungen</h2>

      {shown.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{group.title}</h2>
          <ul className="flex flex-col">
            {group.honors.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-white/10 py-2"
              >
                <span className="flex flex-col">
                  <span>{h.title}</span>
                  <span className="opacity-60">{h.description}</span>
                </span>
                <span className="flex flex-col sm:items-end">
                  {h.winners.map((e) => (
                    <span key={`${e.playerId}:${e.label}`}>
                      <span className="font-medium">{e.name}</span>{" "}
                      <span className="tabular-nums opacity-70">{e.label}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
