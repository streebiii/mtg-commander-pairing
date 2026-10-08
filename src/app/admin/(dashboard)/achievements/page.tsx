import { prisma } from "@/lib/prisma";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/achievements";
import AchievementRow from "./AchievementRow";
import { createAchievement } from "./actions";
import CreateAchievementButton from "./CreateAchievementButton";
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
      repeatable: a.repeatable,
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

      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-medium">Katalog</h2>
          <p className="text-xs opacity-70">
            Änderungen werden automatisch gespeichert und gelten nur für
            künftige Abende — laufende und vergangene behalten ihren Stand.
            Achievements werden nicht gelöscht, sondern deaktiviert.
          </p>
        </div>

        {CATEGORIES.map((category) => {
          const items = achievements.filter((a) => a.category === category);
          return (
            <div key={category} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {CATEGORY_LABELS[category]} ({items.length})
              </h3>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="py-2 pr-3">Titel</th>
                      <th className="py-2 pr-3">Beschreibung</th>
                      <th className="py-2 pr-3">Punkte</th>
                      <th className="py-2 pr-3">Art</th>
                      <th className="py-2 pr-3">Mehrfach</th>
                      <th className="py-2 pr-3">Aktiv</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <AchievementRow
                        key={a.id}
                        achievement={{
                          id: a.id,
                          title: a.title,
                          description: a.description,
                          points: a.points,
                          scope: a.scope,
                          repeatable: a.repeatable,
                          active: a.active,
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Achievement anlegen</h2>
        <form
          action={createAchievement}
          className="flex max-w-3xl flex-wrap items-end gap-3"
        >
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Titel
            <input
              type="text"
              name="title"
              required
              className="min-h-9 w-full rounded border border-white/20 px-3 py-2 sm:w-56"
            />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm">
            Beschreibung
            <input
              type="text"
              name="description"
              className="min-h-9 w-full rounded border border-white/20 px-3 py-2"
            />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Punkte
            <input
              type="number"
              name="points"
              required
              defaultValue={1}
              className="min-h-9 w-full rounded border border-white/20 px-3 py-2 sm:w-20"
            />
          </label>
          <label className="flex w-full flex-col gap-1.5 text-sm sm:w-auto">
            Kategorie
            <select
              name="category"
              defaultValue="ROTATING"
              className="min-h-9 w-full rounded border border-white/20 px-3 py-2 sm:w-auto"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 w-full items-center gap-2 text-sm sm:w-auto">
            <input type="checkbox" name="repeatable" className="h-4 w-4" />
            Zählt mehrfach
          </label>
          <CreateAchievementButton />
        </form>
        <p className="text-xs opacity-70">
          Die Art (pro Match, pro Abend, am Ende der Liga) wird aus der
          Kategorie vorbelegt und lässt sich danach im Katalog ändern.
        </p>
      </section>
    </div>
  );
}
