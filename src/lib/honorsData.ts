import { prisma } from "@/lib/prisma";
import { computeHonors } from "@/lib/honors";
import { loadPublicNames } from "@/lib/publicRoster";
import { loadSeasonEvenings } from "@/lib/rankingData";

/**
 * Die Ehrungen der laufenden Saison (SPEC.md Abschnitt 15) aus denselben
 * Runden wie die Rangliste: nur geschlossene, einer Spalte zugeordnete.
 * Namen wie in der Rangliste, weil sie an die Wand projiziert werden.
 */
export async function loadHonors() {
  const [players, evenings, names, open] = await Promise.all([
    prisma.player.findMany({
      where: { leagueActive: true },
      select: { id: true, firstName: true },
    }),
    loadSeasonEvenings(),
    loadPublicNames(),
    prisma.evening.count({ where: { entryClosedAt: null } }),
  ]);
  return {
    ...computeHonors(
      players.map((p) => ({ id: p.id, name: names.get(p.id) ?? p.firstName })),
      evenings,
    ),
    /** Läuft eine Erfassung noch? Dann fehlt deren Runde. */
    entryOpen: open > 0,
  };
}
