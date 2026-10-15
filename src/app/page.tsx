import AutoRefresh from "@/components/AutoRefresh";
import PublicHeader from "@/components/PublicHeader";
import { loadPublicPairings, pairingsVersion } from "@/lib/publicPairings";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SCOPE_LABELS,
  formatPoints,
  isRepeatable,
} from "@/lib/achievements";

// Öffentliche, ungeschützte Lese-Ansicht der aktuellen Tischzuteilung
// (siehe SPEC.md Abschnitt 2). Kein Login nötig — gedacht zum Anzeigen auf
// einem Bildschirm oder zum Teilen des Links mit den Spielern. Bewusst die
// Startseite ("/") — der Organisator-Bereich liegt unter /admin.
//
// Es läuft immer nur eines von beidem: entweder eine Casual-Zuteilung oder
// ein Liga-Abend (siehe loadPublicPairings). Ändert sich daran etwas, lädt
// die offene Seite von selbst neu (AutoRefresh).
export const dynamic = "force-dynamic";

export default async function Home() {
  const pairings = await loadPublicPairings();
  const { tables, achievements, matchNumber } = pairings;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <PublicHeader active="pairings" />
      <AutoRefresh version={pairingsVersion(pairings)} />

      {tables.length === 0 ? (
        <p className="text-base opacity-70">
          Gerade sind keine Tische zugeteilt. Sobald der Organisator die
          Zuteilung freigibt, erscheinen hier die aktuellen Tische.
        </p>
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">
            {matchNumber !== null ? `Match ${matchNumber}` : "Tische"}
          </h2>
          <div className="flex flex-wrap gap-5">
            {tables.map((table) => (
              <div
                key={table.key}
                className="w-full rounded border border-white/20 p-5 sm:w-56"
              >
                <div className="mb-3 text-lg font-semibold">
                  Tisch {table.tableNumber}
                </div>
                <ul className="flex flex-col gap-1.5 text-base">
                  {table.players.map((p) => (
                    <li key={p.key}>{p.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {achievements.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold">Achievements heute</h2>
          {CATEGORIES.map((category) => {
            const items = achievements.filter((a) => a.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} className="flex flex-col gap-2">
                <h3 className="text-base font-medium opacity-70">
                  {CATEGORY_LABELS[category]}
                </h3>
                <ul className="flex flex-col gap-2 text-base">
                  {items.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="w-8 shrink-0 tabular-nums opacity-70">
                        {formatPoints(a.points)}
                      </span>
                      <span>
                        <span className="font-medium">{a.title}</span>
                        {isRepeatable(a.scope) && (
                          <span className="opacity-70">
                            {" "}
                            ({SCOPE_LABELS[a.scope]})
                          </span>
                        )}
                        {a.description && (
                          <span className="whitespace-pre-line opacity-70">
                            {" "}
                            — {a.description}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
