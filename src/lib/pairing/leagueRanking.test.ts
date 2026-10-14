import { describe, expect, it } from "vitest";
import {
  DAEMPFUNG_ABENDE,
  SIEG_BONUS_RAENGE,
  dampedAverage,
  leagueAverage,
  rankValues,
} from "./leagueRanking";

/**
 * Stand der Commander-Liga 2026 nach drei Abenden (mtgbl.ch). Punkte und
 * Abende sind die Originaldaten — an ihnen ist die Entscheidung getroffen
 * worden, nach Punkten pro Abend statt nach der Gesamtsumme zu sortieren.
 * Die Namen sind erfunden.
 */
const STAND = [
  { id: "Anna S.", points: 50, attendedEvenings: 3 },
  { id: "Bruno S.", points: 44, attendedEvenings: 3 },
  { id: "Cyril", points: 40, attendedEvenings: 3 },
  { id: "Dora S.", points: 39, attendedEvenings: 3 },
  { id: "Emil", points: 36, attendedEvenings: 3 },
  { id: "Fiona", points: 36, attendedEvenings: 3 },
  { id: "Gustav", points: 35, attendedEvenings: 3 },
  { id: "Anna Sommerfeld.", points: 30, attendedEvenings: 3 },
  { id: "Hugo", points: 30, attendedEvenings: 3 },
  { id: "Ida", points: 29, attendedEvenings: 3 },
  { id: "Jakob N.", points: 28, attendedEvenings: 3 },
  { id: "Anna V.", points: 27, attendedEvenings: 3 },
  { id: "Kurt", points: 25, attendedEvenings: 3 },
  { id: "Lea", points: 24, attendedEvenings: 3 },
  { id: "Moritz", points: 21, attendedEvenings: 2 },
  { id: "Nora", points: 20, attendedEvenings: 3 },
  { id: "Otto", points: 18, attendedEvenings: 3 },
  { id: "Paula", points: 18, attendedEvenings: 3 },
  { id: "Quirin", points: 18, attendedEvenings: 2 },
  { id: "Rosa", points: 17, attendedEvenings: 2 },
  { id: "Bruno K.", points: 15, attendedEvenings: 3 },
  { id: "Silas", points: 14, attendedEvenings: 3 },
  { id: "Tanja", points: 11, attendedEvenings: 1 },
  { id: "Udo", points: 8, attendedEvenings: 1 },
  { id: "Vera", points: 8, attendedEvenings: 1 },
  { id: "Willi", points: 7, attendedEvenings: 2 },
  { id: "Xenia", points: 4, attendedEvenings: 1 },
  { id: "Yann", points: 4, attendedEvenings: 1 },
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
    const tanja = STAND.find((p) => p.id === "Tanja")!;
    // Ungedämpft wären es 11,0 — mit zwei Vorschuss-Abenden 9,9.
    expect(tanja.points / tanja.attendedEvenings).toBe(11);
    expect(dampedAverage(tanja, schnitt)).toBeCloseTo(9.91, 2);
  });

  it("lässt Spieler mit vielen Abenden fast unberührt", () => {
    const anna = STAND.find((p) => p.id === "Anna S.")!;
    const roh = anna.points / anna.attendedEvenings;
    expect(Math.abs(dampedAverage(anna, schnitt) - roh)).toBeLessThan(3);
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
      "Anna S.",
      "Bruno S.",
      "Cyril",
      "Dora S.",
      "Emil",
      "Fiona",
      "Gustav",
    ]);
  });

  it("hebt Spieler, die Abende verpasst haben, aus dem Tabellenkeller", () => {
    // Tanja steht in der offiziellen Rangliste auf Platz 23 von 28.
    expect(position("Tanja")).toBeLessThan(12);
    expect(position("Moritz")).toBeLessThan(12);
  });

  it("senkt regelmässige Spieler mit schwachem Schnitt", () => {
    // Silas war an allen drei Abenden dabei und holt 4,7 pro Abend.
    expect(position("Silas")).toBeGreaterThan(20);
  });

  it("vergibt dem Sieger genau SIEG_BONUS_RAENGE Ränge", () => {
    const ohne = rankValues(STAND).find((w) => w.id === "Lea")!;
    const mit = rankValues(STAND, new Set(["Lea"])).find((w) => w.id === "Lea")!;
    expect(mit.points - ohne.points).toBe(SIEG_BONUS_RAENGE);
  });

  it("hebt einen Sieger vom hinteren Tisch nicht durch den Bonus an die Spitze", () => {
    const sieger = new Set(["Yann"]);
    const werte = rankValues(STAND, sieger);
    const yann = werte.find((w) => w.id === "Yann")!;
    const bester = Math.max(
      ...werte.filter((w) => w.id !== "Yann").map((w) => w.points),
    );
    // Yann steht auch nach dem Sieg 19 Ränge unter der Spitze — der
    // Sieg-Bonus holt davon nur einen Bruchteil auf.
    expect(bester - yann.points).toBeGreaterThan(15);
    expect(bester - yann.points).toBeGreaterThan(SIEG_BONUS_RAENGE * 4);
    // assignLeagueRound teilt danach ohnehin in obere/untere Hälfte auf
    // (siehe leagueAssignment.ts) — bei so grossem Abstand bleibt Yann
    // sicher in der unteren Hälfte, unabhängig vom Sieg-Bonus.
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
