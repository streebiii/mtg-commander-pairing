import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCasualPairing } from "@/lib/casualPairing";
import { formatPlayerName } from "@/lib/players";

// Öffentliche, ungeschützte Lese-Ansicht der aktuellen Tischzuteilung
// (siehe SPEC.md Abschnitt 2). Kein Login nötig — gedacht zum Anzeigen auf
// einem Bildschirm oder zum Teilen des Links mit den Spielern. Bewusst die
// Startseite ("/") — der Organisator-Bereich liegt unter /admin.
//
// Es läuft immer nur eines von beidem: entweder eine Casual-Zuteilung oder
// ein Liga-Abend. Existiert eine Casual-Zuteilung, hat sie Vorrang; sie wird
// über "Zurücksetzen" im Casual-Tab wieder entfernt, und das Starten eines
// Liga-Abends verwirft sie ebenfalls. Spieler-Stufen tauchen hier nie auf
// (siehe SPEC.md Abschnitt 6.1).
export const dynamic = "force-dynamic";

interface DisplayTable {
  key: string;
  tableNumber: number;
  players: { key: string; name: string }[];
}

export default async function Home() {
  const casualTables = await getCasualPairing();

  let tables: DisplayTable[] = casualTables.map((t) => ({
    key: `casual-${t.tableNumber}`,
    tableNumber: t.tableNumber,
    players: t.players.map((p) => ({ key: p.id, name: p.name })),
  }));

  if (tables.length === 0) {
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

    tables =
      evening?.rounds[0]?.tables.map((t) => ({
        key: t.id,
        tableNumber: t.tableNumber,
        players: t.assignments.map((a) => ({
          key: a.id,
          name: formatPlayerName(a.player),
        })),
      })) ?? [];
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        {/* Vereinslogo von mtgbl.ch. Der Bär ist schwarz auf transparentem
            Grund und wird invertiert, damit er auf dem dunklen Hintergrund
            sichtbar bleibt. Die App kennt nur noch Dunkel, deshalb fest und
            nicht mehr als `dark:`-Variante. */}
        <Image
          src="/logo.png"
          alt="MTG Baselland"
          width={213}
          height={191}
          priority
          className="h-10 w-auto invert"
        />
        <h1 className="text-2xl font-semibold">Pairings</h1>
      </div>

      {tables.length === 0 ? (
        <p className="text-sm opacity-70">
          Gerade sind keine Tische zugeteilt. Sobald der Organisator die
          Zuteilung berechnet, erscheinen hier die aktuellen Tische.
        </p>
      ) : (
        <div className="flex flex-wrap gap-5">
          {tables.map((table) => (
            <div
              key={table.key}
              className="w-full rounded border border-white/20 p-5 sm:w-56"
            >
              <div className="mb-3 text-lg font-semibold">
                Tisch {table.tableNumber}
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {table.players.map((p) => (
                  <li key={p.key}>{p.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
