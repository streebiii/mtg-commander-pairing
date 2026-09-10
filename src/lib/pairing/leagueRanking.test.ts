import { describe, expect, it } from "vitest";
import {
  DAEMPFUNG_ABENDE,
  SIEG_BONUS_RAENGE,
  dampedAverage,
  leagueAverage,
  rankValues,
} from "./leagueRanking";

/**
 * Echter Stand der Commander-Liga 2026 nach drei Abenden (mtgbl.ch).
 * Bewusst die Originaldaten: an ihnen ist die Entscheidung getroffen
 * worden, nach Punkten pro Abend statt nach der Gesamtsumme zu sortieren.
 */
const STAND = [
  { id: "Marc S.", points: 50, attendedEvenings: 3 },
  { id: "Thomas S.", points: 44, attendedEvenings: 3 },
  { id: "Tyrone", points: 40, attendedEvenings: 3 },
  { id: "Rafael S.", points: 39, attendedEvenings: 3 },
  { id: "Georg", points: 36, attendedEvenings: 3 },
  { id: "Fabian", points: 36, attendedEvenings: 3 },
  { id: "Rayaan", points: 35, attendedEvenings: 3 },
  { id: "Marc Sobo.", points: 30, attendedEvenings: 3 },
  { id: "Philippe", points: 30, attendedEvenings: 3 },
  { id: "Debora", points: 29, attendedEvenings: 3 },
  { id: "Christophe N.", points: 28, attendedEvenings: 3 },
  { id: "Marc V.", points: 27, attendedEvenings: 3 },
  { id: "Sander", points: 25, attendedEvenings: 3 },
  { id: "Timo", points: 24, attendedEvenings: 3 },
  { id: "Mario", points: 21, attendedEvenings: 2 },
  { id: "Floyd", points: 20, attendedEvenings: 3 },
  { id: "Rolf", points: 18, attendedEvenings: 3 },
  { id: "Lennox", points: 18, attendedEvenings: 3 },
  { id: "Raffa", points: 18, attendedEvenings: 2 },
  { id: "Danilo", points: 17, attendedEvenings: 2 },
  { id: "Thomas K.", points: 15, attendedEvenings: 3 },
  { id: "Caspar", points: 14, attendedEvenings: 3 },
  { id: "David", points: 11, attendedEvenings: 1 },
  { id: "Niklas", points: 8, attendedEvenings: 1 },
  { id: "Ruth", points: 8, attendedEvenings: 1 },
  { id: "Jonathan", points: 7, attendedEvenings: 2 },
  { id: "Chris", points: 4, attendedEvenings: 1 },
  { id: "Joshua", points: 4, attendedEvenings: 1 },
];

/** Position eines Spielers in der berechneten Rangfolge (0 = oben). */
function position(id: string, sieger = new Set<string>()): number {
  const werte = rankValues(STAND, sieger);
  const eintrag = werte.find((w) => w.id === id)!;
  // points ist der negative Rangplatz, ggf. plus Sieg-Bonus.
  return -(eintrag.points - (sieger.has(id) ? SIEG_BONUS_RAENGE : 0));
}

describe("leagueAverage", () => {
  it("mittelt über alle gespielten Spieler-Abende, nicht über die Spieler", () => {
    // 656 Punkte auf 70 Teilnahmen.
    expect(leagueAverage(STAND)).toBeCloseTo(9.37, 2);
  });

  it("liefert 0, wenn keine Abende hinterlegt sind", () => {
    const ohne = STAND.map((p) => ({ ...p, attendedEvenings: 0 }));
    expect(leagueAverage(ohne)).toBe(0);
  });
});

describe("dampedAverage", () => {
  const schnitt = leagueAverage(STAND);

  it("zieht einen einzelnen Abend stark zur Mitte", () => {
    const david = STAND.find((p) => p.id === "David")!;
    // Ungedämpft wären es 11,0 — mit zwei Vorschuss-Abenden 9,9.
    expect(david.points / david.attendedEvenings).toBe(11);
    expect(dampedAverage(david, schnitt)).toBeCloseTo(9.91, 2);
  });

  it("lässt Spieler mit vielen Abenden fast unberührt", () => {
    const marc = STAND.find((p) => p.id === "Marc S.")!;
    const roh = marc.points / marc.attendedEvenings;
    expect(Math.abs(dampedAverage(marc, schnitt) - roh)).toBeLessThan(3);
  });

  it("verwendet DAEMPFUNG_ABENDE als Gewicht", () => {
    const p = { id: "x", points: 0, attendedEvenings: 0 };
    // Ohne eigene Daten ist man exakt Durchschnitt.
    expect(dampedAverage(p, schnitt)).toBeCloseTo(schnitt, 6);
    expect(DAEMPFUNG_ABENDE).toBe(2);
  });
});

describe("rankValues", () => {
  it("lässt die Spitze unverändert — dort waren alle immer dabei", () => {
    const oben = rankValues(STAND).slice(0, 7).map((w) => w.id);
    expect(oben).toEqual([
      "Marc S.",
      "Thomas S.",
      "Tyrone",
      "Rafael S.",
      "Georg",
      "Fabian",
      "Rayaan",
    ]);
  });

  it("hebt Spieler, die Abende verpasst haben, aus dem Tabellenkeller", () => {
    // David steht in der offiziellen Rangliste auf Platz 23 von 28.
    expect(position("David")).toBeLessThan(12);
    expect(position("Mario")).toBeLessThan(12);
  });

  it("senkt regelmässige Spieler mit schwachem Schnitt", () => {
    // Caspar war an allen drei Abenden dabei und holt 4,7 pro Abend.
    expect(position("Caspar")).toBeGreaterThan(20);
  });

  it("vergibt dem Sieger genau SIEG_BONUS_RAENGE Ränge", () => {
    const ohne = rankValues(STAND).find((w) => w.id === "Timo")!;
    const mit = rankValues(STAND, new Set(["Timo"])).find((w) => w.id === "Timo")!;
    expect(mit.points - ohne.points).toBe(SIEG_BONUS_RAENGE);
  });

  it("hebt einen Sieger vom hinteren Tisch nicht durch den Bonus an die Spitze", () => {
    const sieger = new Set(["Joshua"]);
    const werte = rankValues(STAND, sieger);
    const joshua = werte.find((w) => w.id === "Joshua")!;
    const bester = Math.max(
      ...werte.filter((w) => w.id !== "Joshua").map((w) => w.points),
    );
    // Joshua steht auch nach seinem Sieg 19 Ränge unter der Spitze — der
    // Bonus von 3 Rängen holt davon nur einen Bruchteil auf.
    expect(bester - joshua.points).toBeGreaterThan(15);
    expect(bester - joshua.points).toBeGreaterThan(SIEG_BONUS_RAENGE * 4);
    // Bewusst NICHT behauptet, dass ihm die Spitze verwehrt bleibt: das
    // Rauschen von RANG_RAUSCHEN kann diesen Abstand in seltenen Fällen
    // überbrücken. Gemessen rund fünfmal pro Saison — als Preis für die
    // Durchmischung angenommen (siehe SPEC.md Abschnitt 5.1).
  });

  it("fällt ohne Abend-Angaben auf die Reihenfolge der Gesamtpunkte zurück", () => {
    const ohne = STAND.map((p) => ({ ...p, attendedEvenings: 0 }));
    const reihenfolge = rankValues(ohne).map((w) => w.id);
    const nachPunkten = [...ohne]
      .sort((a, b) => b.points - a.points)
      .map((p) => p.id);
    expect(reihenfolge).toEqual(nachPunkten);
  });
});
