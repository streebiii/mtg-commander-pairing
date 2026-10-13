import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import { loadRanking } from "@/lib/rankingData";
import { SEASON_YEAR } from "@/lib/season";
import RankingTable from "./RankingTable";

// Öffentliche Rangliste der Saison (siehe SPEC.md Abschnitt 13), ohne
// Login. Ein Abend aus der App erscheint erst, wenn der Organisator die
// Erfassung geschlossen hat.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rangliste · Commander" };

export default async function RankingPage() {
  const ranking = await loadRanking();

  const appDates = Object.fromEntries(
    [...ranking.appDates].map(([round, date]) => [
      round,
      date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }),
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <PublicHeader active="rangliste" />

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          Commander-Liga {SEASON_YEAR}
          {ranking.lastRound !== null && ` · Stand nach R${ranking.lastRound}`}
        </h2>
        <p className="text-base opacity-70">
          Unterstrichene Punkte stammen aus der Achievement-Erfassung — mit
          der Maus darauf zeigen oder antippen, um die Achievements des Abends
          zu sehen. Nach dem letzten Abend zählt das schlechteste Resultat
          nicht (durchgestrichen).
        </p>
      </div>

      {ranking.rows.length === 0 ? (
        <p className="text-base opacity-70">Noch keine Liga-Teilnehmenden.</p>
      ) : (
        <RankingTable rows={ranking.rows} appDates={appDates} />
      )}
    </div>
  );
}
