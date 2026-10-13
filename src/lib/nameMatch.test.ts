import { describe, expect, it } from "vitest";
import { matchPlayerName } from "./nameMatch";

const players = [
  { id: "1", firstName: "Marc", lastName: "S" },
  { id: "2", firstName: "Marc", lastName: "Sobo" },
  { id: "3", firstName: "Marc", lastName: "Vogt" },
  { id: "4", firstName: "David", lastName: "Latscha" },
  { id: "5", firstName: "Fabian", lastName: null },
  { id: "6", firstName: "Thomas", lastName: "Steiner" },
  { id: "7", firstName: "Thomas", lastName: "Keller" },
];
const ids = (name: string) => matchPlayerName(name, players).map((p) => p.id);

describe("matchPlayerName", () => {
  it("findet den ganzen Namen auch mit Punkt", () => {
    expect(ids("Marc S.")).toEqual(["1"]);
    expect(ids("Marc Sobo.")).toEqual(["2"]);
  });

  it("findet ein Nachnamen-Kürzel", () => {
    expect(ids("Marc V.")).toEqual(["3"]);
    expect(ids("Thomas S.")).toEqual(["6"]);
    expect(ids("Thomas K.")).toEqual(["7"]);
  });

  it("findet einen Vornamen allein", () => {
    expect(ids("David")).toEqual(["4"]);
    expect(ids("Fabian")).toEqual(["5"]);
  });

  it("meldet mehrdeutige und fehlende Namen als solche", () => {
    expect(ids("Marc")).toHaveLength(3);
    expect(ids("Ruth")).toEqual([]);
  });
});
