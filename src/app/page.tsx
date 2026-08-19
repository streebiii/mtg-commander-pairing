import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";

// Öffentliche, ungeschützte Lese-Ansicht der aktuellen Tischzuteilung
// (siehe SPEC.md Abschnitt 2). Kein Login nötig — gedacht zum Anzeigen auf
// einem Bildschirm oder zum Teilen des Links mit den Spielern. Bewusst die
// Startseite ("/") — der Organisator-Bereich liegt unter /admin.
//
// Zeigt die aktuelle Runde des laufenden Liga-Abends (Modus B). Modus-A-
// Abende (Casual) werden bewusst nicht persistiert (siehe SPEC.md
// Abschnitt 4 und 9) und erscheinen daher hier nicht — sie werden direkt
// im Organisator-Browser angezeigt/geteilt.
export const dynamic = "force-dynamic";
export const metadata = { title: "Aktuelle Pairings" };

export default async function Home() {
  const evening = await prisma.evening.findFirst({
    where: { mode: "LEAGUE", finishedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      rounds: {
        orderBy: { number: "desc" },
        take: 1,
        include: {
          tables: {
            orderBy: { tableNumber: "asc" },
            include: {
              assignments: {
                include: { player: true },
                orderBy: [
                  { player: { firstName: "asc" } },
                  { player: { lastName: "asc" } },
                ],
              },
            },
          },
        },
      },
    },
  });

  const round = evening?.rounds[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Aktuelle Pairings</h1>

      {!round ? (
        <p className="text-sm opacity-70">
          Gerade läuft kein Liga-Abend. Sobald der Organisator einen Abend
          startet, erscheinen hier die aktuellen Tischzuteilungen.
        </p>
      ) : (
        <>
          <p className="text-sm opacity-70">Runde {round.number}</p>
          <div className="flex flex-wrap gap-5">
            {round.tables.map((table) => (
              <div
                key={table.id}
                className="w-full rounded border border-black/20 p-5 dark:border-white/20 sm:w-56"
              >
                <div className="mb-3 text-lg font-semibold">
                  Tisch {table.tableNumber}
                </div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {table.assignments.map((a) => (
                    <li key={a.id}>{formatPlayerName(a.player)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
