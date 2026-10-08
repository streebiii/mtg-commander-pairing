import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getCasualPairing } from "@/lib/casualPairing";
import { formatPlayerName } from "@/lib/players";
import { CATEGORIES, CATEGORY_LABELS, formatPoints } from "@/lib/achievements";

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

interface DisplayAchievement {
  id: string;
  title: string;
  description: string;
  points: number;
  repeatable: boolean;
  category: (typeof CATEGORIES)[number];
}

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

  // Die geltenden Achievements des laufenden Liga-Abends, damit die
  // Spieler sie am Tisch nachschlagen können (siehe SPEC.md Abschnitt 11).
  let achievements: DisplayAchievement[] = [];

  if (tables.length === 0) {
    const evening = await prisma.evening.findFirst({
      where: { mode: "LEAGUE", finishedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        achievements: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            points: true,
            repeatable: true,
            category: true,
          },
        },
        rounds: {
          // Nur veröffentlichte Runden — eine gerade im Warteraum
          // geprüfte Zuteilung ist bewusst noch nicht öffentlich
          // sichtbar (siehe Grill-Notizen). Solange die neueste Runde
          // noch nicht live ist, bleibt hier die vorherige stehen.
          where: { publishedAt: { not: null } },
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
    achievements = evening?.achievements ?? [];
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

      {achievements.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold">Achievements heute</h2>
          {CATEGORIES.map((category) => {
            const items = achievements.filter((a) => a.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium opacity-70">
                  {CATEGORY_LABELS[category]}
                </h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {items.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="w-8 shrink-0 tabular-nums opacity-70">
                        {formatPoints(a.points, false)}
                      </span>
                      <span>
                        <span className="font-medium">{a.title}</span>
                        {a.repeatable && (
                          <span className="opacity-70"> (mehrfach)</span>
                        )}
                        {a.description && (
                          <span className="opacity-70"> — {a.description}</span>
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
