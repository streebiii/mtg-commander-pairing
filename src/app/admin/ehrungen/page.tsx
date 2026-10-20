import type { Metadata } from "next";
import { loadHonors } from "@/lib/honorsData";
import { SEASON_YEAR } from "@/lib/season";
import HonorsShow from "./HonorsShow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ehrungen" };

// Präsentation der Ehrungen für den Beamer (SPEC.md Abschnitt 15) —
// bewusst ausserhalb des Dashboard-Layouts, damit keine Navigation
// mitprojiziert wird. Liegt unter /admin und ist damit nur für den
// Organisator erreichbar (src/proxy.ts).
export default async function HonorsShowPage() {
  const { facts, groups } = await loadHonors();
  // Ehrungen ohne Geehrte fallen weg, Themen ohne Ehrung ebenso.
  const shown = groups
    .map((g) => ({ ...g, honors: g.honors.filter((h) => h.winners.length > 0) }))
    .filter((g) => g.honors.length > 0);
  return <HonorsShow season={SEASON_YEAR} facts={facts} groups={shown} />;
}
