import { describe, expect, it } from "vitest";
import { publicNames, shortPlayerName } from "./players";

describe("publicNames", () => {
  const roster = [
    { id: "1", firstName: "Anna", lastName: "Muster" },
    { id: "2", firstName: "Ben", lastName: null },
    { id: "3", firstName: "Carl", lastName: "Steiner" },
    { id: "4", firstName: "Carl", lastName: "Sommer" },
    { id: "5", firstName: "Carl", lastName: "Vogel" },
    { id: "6", firstName: "Dana", lastName: "K" },
    { id: "7", firstName: "Eva", lastName: "Del Monte" },
  ];
  const names = publicNames(roster);

  it("kürzt den Nachnamen auf das Initial", () => {
    expect(names.get("1")).toBe("Anna M.");
    expect(names.get("5")).toBe("Carl V.");
    expect(names.get("7")).toBe("Eva D.");
  });

  it("lässt Spieler ohne Nachnamen beim Vornamen", () => {
    expect(names.get("2")).toBe("Ben");
  });

  it("nimmt bei gleichem Initial so viele Buchstaben wie nötig", () => {
    expect(names.get("3")).toBe("Carl St.");
    expect(names.get("4")).toBe("Carl So.");
  });

  it("setzt bei einem Nachnamen aus einem Buchstaben keinen doppelten Punkt", () => {
    expect(names.get("6")).toBe("Dana K.");
    expect(publicNames([{ id: "x", firstName: "Dana", lastName: "K." }]).get("x")).toBe("Dana K.");
  });
});

describe("shortPlayerName", () => {
  it("kürzt ohne Bestand auf das Initial", () => {
    expect(shortPlayerName({ firstName: "Anna", lastName: "Muster" })).toBe("Anna M.");
    expect(shortPlayerName({ firstName: "Ben" })).toBe("Ben");
  });
});
