import { describe, expect, it } from "vitest";
import { matchImportRows, type ExistingPlayer } from "./playerMatch";

describe("matchImportRows", () => {
  it("matched eindeutig per Vorname, wenn nur ein Kandidat existiert", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Tyrone", lastName: null },
    ];
    const [match] = matchImportRows([{ importName: "Tyrone", total: 40 }], players);
    expect(match).toMatchObject({ matchType: "exact", matchedPlayerId: "p1" });
  });

  it("matched per abgekürztem Nachnamen (Initiale mit Punkt)", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Marc", lastName: "Strebel" },
    ];
    const [match] = matchImportRows([{ importName: "Marc S.", total: 50 }], players);
    expect(match).toMatchObject({ matchType: "exact", matchedPlayerId: "p1" });
  });

  it("markiert als 'new', wenn kein Spieler mit passendem Vornamen existiert", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Alice", lastName: null },
    ];
    const [match] = matchImportRows([{ importName: "Georg", total: 36 }], players);
    expect(match).toMatchObject({
      matchType: "new",
      suggestedFirstName: "Georg",
      suggestedLastName: null,
    });
  });

  it("übernimmt den abgekürzten Nachnamen (ohne Punkt) als Vorschlag bei 'new'", () => {
    const [match] = matchImportRows([{ importName: "Rafael S.", total: 39 }], []);
    expect(match).toMatchObject({
      matchType: "new",
      suggestedFirstName: "Rafael",
      suggestedLastName: "S",
    });
  });

  it("ist mehrdeutig, wenn zwei Spieler denselben Vornamen haben und der Nachname nicht unterscheidet", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Marc", lastName: "Strebel" },
      { id: "p2", firstName: "Marc", lastName: "Suter" },
    ];
    const [match] = matchImportRows([{ importName: "Marc S.", total: 50 }], players);
    expect(match.matchType).toBe("ambiguous");
    if (match.matchType === "ambiguous") {
      expect(match.candidates.map((c) => c.id).sort()).toEqual(["p1", "p2"]);
    }
  });

  it("löst Mehrdeutigkeit auf, wenn der Nachname eindeutig unterscheidet", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Marc", lastName: "Strebel" },
      { id: "p2", firstName: "Marc", lastName: "Meier" },
    ];
    const [match] = matchImportRows([{ importName: "Marc S.", total: 50 }], players);
    expect(match).toMatchObject({ matchType: "exact", matchedPlayerId: "p1" });
  });

  it("markiert als mehrdeutig, wenn ein einzelner Kandidat einen widersprüchlichen Nachnamen hat", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Marc", lastName: "Strebel" },
    ];
    const [match] = matchImportRows([{ importName: "Marc K.", total: 50 }], players);
    expect(match.matchType).toBe("ambiguous");
  });

  it("matched ohne Nachname-Info, wenn nur ein Kandidat mit gleichem Vornamen existiert", () => {
    const players: ExistingPlayer[] = [
      { id: "p1", firstName: "Fabian", lastName: null },
    ];
    const [match] = matchImportRows([{ importName: "Fabian", total: 36 }], players);
    expect(match).toMatchObject({ matchType: "exact", matchedPlayerId: "p1" });
  });
});
