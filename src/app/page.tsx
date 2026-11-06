import AutoRefresh from "@/components/AutoRefresh";
import PublicHeader from "@/components/PublicHeader";
import { loadPublicPairings, pairingsVersion } from "@/lib/publicPairings";

// Öffentliche, ungeschützte Lese-Ansicht der aktuellen Tischzuteilung
// (siehe SPEC.md Abschnitt 2). Kein Login nötig — gedacht zum Anzeigen auf
// einem Bildschirm oder zum Teilen des Links mit den Spielern. Bewusst die
// Startseite ("/") — der Organisator-Bereich liegt unter /admin.
//
// Die Achievements des Abends stehen hier bewusst nicht (mehr): jeder hat
// sie auf seinem Punkteblatt (Entscheid des Organisators vom 06.11.2026).
//
// Es läuft immer nur eines von beidem: entweder eine Casual-Zuteilung oder
// ein Liga-Abend (siehe loadPublicPairings). Ändert sich daran etwas, lädt
// die offene Seite von selbst neu (AutoRefresh).
export const dynamic = "force-dynamic";

export default async function Home() {
  const pairings = await loadPublicPairings();
  const { tables, matchNumber } = pairings;

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
    </div>
  );
}
