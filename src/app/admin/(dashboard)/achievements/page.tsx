import { prisma } from "@/lib/prisma";
import AchievementTable from "./AchievementTable";

export const dynamic = "force-dynamic";

// Achievement-Katalog der Liga (siehe SPEC.md Abschnitt 11). Was aktiv
// ist, gilt am nächsten Liga-Abend; bei den rotierenden werden nach jeder
// Ziehung auf mtgbl.ch die neuen 10 aktiv und die bisherigen inaktiv
// gestellt.
export default async function AchievementsPage() {
  const achievements = await prisma.achievement.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Achievements</h1>
        <p className="text-sm opacity-70">
          Alle aktiven Achievements gelten am nächsten Liga-Abend. Bei den
          rotierenden stellst du nach jeder Ziehung auf mtgbl.ch die neuen 10
          aktiv und die bisherigen inaktiv. Ein gestarteter Abend behält
          seine Liste, Änderungen wirken erst auf den nächsten.
        </p>
      </div>

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
