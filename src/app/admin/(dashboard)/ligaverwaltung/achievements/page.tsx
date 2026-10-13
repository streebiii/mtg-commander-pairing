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
      <p className="max-w-3xl text-base opacity-70">
        Alle aktiven Achievements gelten in der nächsten Runde. Bei den
        rotierenden stellst du nach jeder Ziehung auf mtgbl.ch die neuen 10
        aktiv und die bisherigen inaktiv. Eine gestartete Runde behält ihre
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
