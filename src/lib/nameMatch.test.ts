import { describe, expect, it } from "vitest";
import { matchPlayerName } from "./nameMatch";

const players = [
  { id: "1", firstName: "Anna", lastName: "S" },
  { id: "2", firstName: "Anna", lastName: "Sommerfeld" },
  { id: "3", firstName: "Anna", lastName: "Velten" },
  { id: "4", firstName: "Tanja", lastName: "Lorenz" },
  { id: "5", firstName: "Fiona", lastName: null },
  { id: "6", firstName: "Bruno", lastName: "Stalder" },
  { id: "7", firstName: "Bruno", lastName: "Kunz" },
];
const ids = (name: string) => matchPlayerName(name, players).map((p) => p.id);

describe("matchPlayerName", () => {
  it("findet den ganzen Namen auch mit Punkt", () => {
    expect(ids("Anna S.")).toEqual(["1"]);
    expect(ids("Anna Sommerfeld.")).toEqual(["2"]);
  });

  it("findet ein Nachnamen-Kürzel", () => {
    expect(ids("Anna V.")).toEqual(["3"]);
    expect(ids("Bruno S.")).toEqual(["6"]);
    expect(ids("Bruno K.")).toEqual(["7"]);
  });

  it("findet einen Vornamen allein", () => {
    expect(ids("Tanja")).toEqual(["4"]);
    expect(ids("Fiona")).toEqual(["5"]);
  });

  it("meldet mehrdeutige und fehlende Namen als solche", () => {
    expect(ids("Anna")).toHaveLength(3);
    expect(ids("Zora")).toEqual([]);
  });
});
