import { prisma } from "@/lib/prisma";
import AchievementTable from "./AchievementTable";
import RotatingSelection from "./RotatingSelection";

export const dynamic = "force-dynamic";

// Achievement-Katalog der Liga und Auswahl der rotierenden (siehe SPEC.md
// Abschnitt 11). Die Ziehung macht mtgbl.ch — hier wird sie nur
// übernommen: vorgemerkt für den nächsten Abend und, solange einer läuft,
// für den laufenden Abend korrigierbar.
export default async function AchievementsPage() {
  const [achievements, runningEvening] = await Promise.all([
    prisma.achievement.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.evening.findFirst({
      where: { mode: "LEAGUE", finishedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        achievements: {
          where: { category: "ROTATING" },
          select: { achievementId: true },
        },
      },
    }),
  ]);

  const rotatingOptions = achievements
    .filter((a) => a.category === "ROTATING" && a.active)
    .map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      points: a.points,
    }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold">Achievements</h1>
        <p className="text-sm opacity-70">
          Pro Liga-Abend gelten alle aktiven fixen und Deckbau-Achievements
          sowie die ausgewählten rotierenden. Massgeblich ist die Liste auf
          mtgbl.ch.
        </p>
      </div>

      {runningEvening && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Rotierende für den laufenden Abend
          </h2>
          <p className="text-xs opacity-70">
            Wurden beim Start des Abends aus der Vormerkung übernommen.
            Änderungen gelten nur für diesen Abend.
          </p>
          <RotatingSelection
            options={rotatingOptions}
            selectedIds={runningEvening.achievements.flatMap((a) =>
              a.achievementId ? [a.achievementId] : [],
            )}
            target={{ kind: "evening", eveningId: runningEvening.id }}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          Rotierende für den nächsten Abend
        </h2>
        <p className="text-xs opacity-70">
          Übernimm hier die Ziehung von mtgbl.ch. Beim Start des nächsten
          Liga-Abends wird die Auswahl übernommen und danach geleert.
        </p>
        <RotatingSelection
          options={rotatingOptions}
          selectedIds={achievements
            .filter((a) => a.nextSelected)
            .map((a) => a.id)}
          target={{ kind: "next" }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Katalog</h2>
          <p className="text-xs opacity-70">
            Änderungen gelten nur für künftige Abende — laufende und
            vergangene behalten ihren Stand. Achievements werden nicht
            gelöscht, sondern deaktiviert.
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
            nextSelected: a.nextSelected,
            sortOrder: a.sortOrder,
          }))}
        />
      </section>
    </div>
  );
}
