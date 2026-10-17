import { prisma } from "@/lib/prisma";
import AchievementTable from "./AchievementTable";

export const dynamic = "force-dynamic";

// Achievement-Katalog der Liga (siehe SPEC.md Abschnitt 11). Was aktiv
// ist, gilt am nächsten Liga-Abend. Die 10 rotierenden lost die App aus
// (DrawPanel); mtgbl.ch übernimmt die Ziehung.
export default async function AchievementsPage() {
  const achievements = await prisma.achievement.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-base opacity-70">
        Alle aktiven Achievements gelten in der nächsten Runde. Die 10
        rotierenden lost du unter «Rotierend» mit «Auslosen» aus und trägst
        sie danach auf mtgbl.ch ein. Eine gestartete Runde behält ihre
        Liste, Änderungen wirken erst auf die nächste.
      </p>

      <AchievementTable
        achievements={achievements.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          points: a.points,
          category: a.category,
          scope: a.scope,
          active: a.active,
          sortOrder: a.sortOrder,
        }))}
      />
    </div>
  );
}
