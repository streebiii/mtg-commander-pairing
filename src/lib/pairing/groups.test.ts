import { describe, expect, it } from "vitest";
import { describeGroupConflict, packGroupsIntoTables } from "./groups";
import { computeTableSizes } from "./tableSizes";

describe("packGroupsIntoTables", () => {
  it("packt eine Gruppe zu 2 in einen 3er-Tisch", () => {
    const result = packGroupsIntoTables([{ id: "g1", size: 2 }], [3]);
    expect(result).not.toBeNull();
    expect(result!.tableGroups).toEqual([["g1"]]);
  });

  it("packt eine Gruppe zu 3 in einen Tisch mit ausreichend Kapazität", () => {
    const result = packGroupsIntoTables([{ id: "g1", size: 3 }], [4, 3]);
    expect(result).not.toBeNull();
    const withGroup = result!.tableGroups.findIndex((g) => g.includes("g1"));
    expect(withGroup).toBeGreaterThanOrEqual(0);
  });

  it("packt eine Gruppe zu 4 nur in einen 4er-Tisch", () => {
    const result = packGroupsIntoTables([{ id: "g1", size: 4 }], [4, 3, 3]);
    expect(result).not.toBeNull();
    expect(result!.tableGroups[0]).toEqual(["g1"]);
  });

  it("erlaubt zwei Gruppen zu 2 am selben 4er-Tisch", () => {
    // N=8 -> [4,4]. Vier Zweier-Gruppen müssen sich zwangsläufig Tische teilen.
    const result = packGroupsIntoTables(
      [
        { id: "a", size: 2 },
        { id: "b", size: 2 },
        { id: "c", size: 2 },
        { id: "d", size: 2 },
      ],
      [4, 4],
    );
    expect(result).not.toBeNull();
    for (const table of result!.tableGroups) {
      expect(table.length).toBe(2);
    }
  });

  it("lehnt eine Gruppe zu 4 bei ausschliesslich 3er-Tischen ab (N=6)", () => {
    const sizes = computeTableSizes(6); // [3, 3]
    const result = packGroupsIntoTables([{ id: "g1", size: 4 }], sizes);
    expect(result).toBeNull();
  });

  it("lehnt vier Zweier-Gruppen bei nur drei Tischen ab", () => {
    // N=9 -> [3,3,3]. Jeder 3er-Tisch fasst höchstens eine Zweier-Gruppe
    // (zwei Zweiergruppen wären zusammen 4 > 3) — bei drei Tischen ist
    // für eine vierte Gruppe kein Platz mehr, obwohl keine Gruppe für
    // sich allein zu gross ist.
    const sizes = computeTableSizes(9); // [3, 3, 3]
    const result = packGroupsIntoTables(
      [
        { id: "a", size: 2 },
        { id: "b", size: 2 },
        { id: "c", size: 2 },
        { id: "d", size: 2 },
      ],
      sizes,
    );
    expect(result).toBeNull();
  });

  it("setzt eine 4er-Gruppe an den 4er-Tisch, nicht an den 5er", () => {
    // N=9 mit erlaubtem 5er-Tisch -> [5, 4]. Die Gruppe soll unter sich
    // bleiben, statt sich den 5er mit einem Fremden zu teilen.
    const sizes = computeTableSizes(9, { allowFiveTable: true }); // [5, 4]
    const result = packGroupsIntoTables([{ id: "g1", size: 4 }], sizes);
    expect(result).not.toBeNull();
    expect(result!.tableGroups).toEqual([[], ["g1"]]);
  });

  it("wählt bei mehreren passenden Tischen den knappsten", () => {
    // Eine 3er-Gruppe passt auf beide Tische; am 4er sitzt nur ein
    // Fremder dabei, am 5er wären es zwei.
    const result = packGroupsIntoTables([{ id: "g1", size: 3 }], [5, 4]);
    expect(result!.tableGroups).toEqual([[], ["g1"]]);
  });

  it("lässt den 5er frei, wenn zwei 4er-Gruppen zwei 4er-Tische haben", () => {
    // N=13 mit erlaubtem 5er-Tisch -> [5, 4, 4].
    const sizes = computeTableSizes(13, { allowFiveTable: true });
    const result = packGroupsIntoTables(
      [
        { id: "a", size: 4 },
        { id: "b", size: 4 },
      ],
      sizes,
    );
    expect(result).not.toBeNull();
    expect(result!.tableGroups[0]).toEqual([]);
    expect(result!.tableGroups[1].concat(result!.tableGroups[2]).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("weicht auf den 5er aus, wenn der 4er schon belegt ist", () => {
    // Zwei 4er-Gruppen, aber nur ein 4er-Tisch: eine muss an den 5er.
    const result = packGroupsIntoTables(
      [
        { id: "a", size: 4 },
        { id: "b", size: 4 },
      ],
      [5, 4],
    );
    expect(result).not.toBeNull();
    expect(result!.tableGroups[0].length).toBe(1);
    expect(result!.tableGroups[1].length).toBe(1);
  });

  it("findet eine Lösung für gemischte Gruppengrössen, wenn eine existiert", () => {
    // N=11 -> [4,4,3]. Gruppe zu 3 + Gruppe zu 2 + Rest Einzelspieler.
    const result = packGroupsIntoTables(
      [
        { id: "a", size: 3 },
        { id: "b", size: 2 },
      ],
      [4, 4, 3],
    );
    expect(result).not.toBeNull();
  });
});

describe("describeGroupConflict", () => {
  const tableSizes = computeTableSizes(6); // [3, 3]

  it("gibt null zurück, wenn es keine Gruppen gibt", () => {
    expect(describeGroupConflict([], tableSizes)).toBeNull();
  });

  it("gibt null zurück, wenn die Gruppen passen", () => {
    const groups = [{ id: "g1", label: "A", playerIds: ["p1", "p2"] }];
    expect(describeGroupConflict(groups, tableSizes)).toBeNull();
  });

  it("nennt die zu grosse Gruppe konkret beim Namen", () => {
    const groups = [
      { id: "g1", label: "A", playerIds: ["p1", "p2", "p3", "p4"] },
    ];
    const conflict = describeGroupConflict(groups, tableSizes);
    expect(conflict).not.toBeNull();
    expect(conflict!.message).toContain("Gruppe A mit 4 Spielern");
    expect(conflict!.message).toContain("3er-Tische");
  });

  it("liefert eine generische Meldung, wenn keine Einzelgruppe zu groß ist", () => {
    // [3,3,3]: vier Zweier-Gruppen passen einzeln (2 <= 3), aber nicht alle
    // zusammen unterzubringen (siehe packGroupsIntoTables-Test oben).
    const groups = [
      { id: "a", label: "A", playerIds: ["p1", "p2"] },
      { id: "b", label: "B", playerIds: ["p3", "p4"] },
      { id: "c", label: "C", playerIds: ["p5", "p6"] },
      { id: "d", label: "D", playerIds: ["p7", "p8"] },
    ];
    const conflict = describeGroupConflict(groups, computeTableSizes(9));
    expect(conflict).not.toBeNull();
    expect(conflict!.message).not.toContain("passt nicht");
  });
});
