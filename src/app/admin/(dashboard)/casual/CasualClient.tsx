"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SKILL_LEVELS } from "@/lib/players";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import {
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  describeGroupConflict,
  type PlayerGroup,
} from "@/lib/pairing/groups";
import { persistCasualPairing, resetCasualPairing } from "./actions";

interface PlayerOption {
  id: string;
  name: string;
  skillLevel: number;
}

interface TableResultPlayer {
  id: string;
  name: string;
  skillLevel: number;
}

interface TableResult {
  tableNumber: number;
  size: number;
  players: TableResultPlayer[];
}

type Mode = "random" | "skill";

/**
 * Zustand von Auswahl und Gruppen wird nur im Browser gehalten (siehe
 * Grill-Notizen) — keine Datenbank-Tabelle, keine Migration. Beides
 * zusammen unter einem Schlüssel, damit nach einem Reload ein in sich
 * konsistenter Stand geladen wird (nie eine Gruppe, deren Mitglieder gar
 * nicht als anwesend markiert sind).
 */
const STORAGE_KEY = "casual-selection-v1";

/** Farbpalette für Gruppen-Kürzel, zyklisch nach Gruppenindex. */
const GROUP_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-pink-600",
  "bg-cyan-600",
];

function groupBadgeColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function groupLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Legt einen neuen Spieler per Quick-Create-API an und gibt ihn zurück. */
async function createPlayerQuick(
  firstName: string,
  lastName: string | null,
  skillLevel: number,
): Promise<{ player?: PlayerOption; error?: string }> {
  try {
    const res = await fetch("/api/admin/players/quick-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, skillLevel }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Unbekannter Fehler" };
    return {
      player: { id: data.id, name: data.name, skillLevel: data.skillLevel },
    };
  } catch {
    return { error: "Netzwerkfehler beim Anlegen" };
  }
}

/** Splittet einen frei getippten Namen naiv in Vorname/Nachname. */
function splitTypedName(text: string): { firstName: string; lastName: string | null } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: tokens[0] ?? text.trim(),
    lastName: tokens.length > 1 ? tokens.slice(1).join(" ") : null,
  };
}

export default function CasualClient({
  players: initialPlayers,
}: {
  players: PlayerOption[];
}) {
  const [players, setPlayers] = useState<PlayerOption[]>(initialPlayers);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("random");
  const [tables, setTables] = useState<TableResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapPick, setSwapPick] = useState<{ table: number; player: string } | null>(
    null,
  );

  // Selektives Neumischen (siehe BACKLOG.md "Casual: einzelne Tische
  // selektiv neu mischen"): Tap auf einen Tisch-Header markiert ihn zum
  // Neumischen, mindestens 2 nötig. Bewusst flüchtiger State — überlebt
  // keinen Reload und setzt sich nach dem Mischen selbst zurück.
  const [selectedForReshuffle, setSelectedForReshuffle] = useState<Set<number>>(
    new Set(),
  );
  const [reshuffling, setReshuffling] = useState(false);

  // Gruppen-Modus: "+ Gruppe bilden" schaltet die Liste kurz um, ein Tap
  // auf einen Spieler nimmt ihn in die entstehende Gruppe auf statt ihn
  // an-/abzuwählen (siehe Grill-Notizen zu Abschnitt 4.1). Bewusst kein
  // Long-press — kollidiert mit Scrollen/Textauswahl auf dem Handy.
  const [groupModeActive, setGroupModeActive] = useState(false);
  const [pendingGroupMembers, setPendingGroupMembers] = useState<string[]>([]);
  const [groupModeHint, setGroupModeHint] = useState<string | null>(null);

  // "Neuen Spieler erfassen" ist ein fester Trigger direkt unter dem
  // Suchfeld (siehe SPEC.md Abschnitt 4) — bewusst NICHT am Ende der
  // Ergebnisliste, sonst rutscht er mit wachsender Spielerliste ausser
  // Reichweite (siehe Bugfix). Öffnet ein kleines Formular
  // (Vorname/Nachname/Elo), vorbefüllt mit dem bisher getippten Suchtext.
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newSkill, setNewSkill] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const selectedCount = selected.size;

  // Auswahl + Gruppen aus dem Browser-Speicher laden. Spieler, die
  // inzwischen archiviert oder gelöscht wurden, fallen dabei still heraus
  // (siehe Grill-Notizen Q8) — sonst nichts von hier aus persistiert.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        selectedIds?: unknown;
        groups?: unknown;
      };
      const knownIds = new Set(initialPlayers.map((p) => p.id));

      const restoredSelected = Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds.filter(
            (id): id is string => typeof id === "string" && knownIds.has(id),
          )
        : [];
      const restoredSelectedSet = new Set(restoredSelected);

      const restoredGroups = Array.isArray(parsed.groups)
        ? parsed.groups
            .map((g): PlayerGroup => {
              const entry = g as { id?: unknown; playerIds?: unknown };
              const playerIds = Array.isArray(entry.playerIds)
                ? entry.playerIds.filter(
                    (id): id is string =>
                      typeof id === "string" && restoredSelectedSet.has(id),
                  )
                : [];
              return {
                id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
                playerIds,
              };
            })
            .filter((g) => g.playerIds.length >= MIN_GROUP_SIZE)
        : [];

      // localStorage existiert erst im Browser (nicht beim Server-Render),
      // daher zwingend erst hier im Effect nachladen — der Anfangszustand
      // bleibt bewusst leer, damit Server- und Client-Markup beim ersten
      // Rendern übereinstimmen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(restoredSelectedSet);
      setGroups(restoredGroups);
    } catch {
      // Ungültiger/korrupter Zustand im Speicher — einfach frisch starten.
    } finally {
      setHydrated(true);
    }
    // Nur beim ersten Rendern laden, initialPlayers ändert sich hier nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auswahl + Gruppen bei jeder Änderung sichern (erst nach dem Laden,
  // sonst würde der leere Anfangszustand den gespeicherten überschreiben).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedIds: [...selected],
        groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
      }),
    );
  }, [hydrated, selected, groups]);

  function addToSelection(player: PlayerOption) {
    setPlayers((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));
    setSelected((prev) => new Set(prev).add(player.id));
  }

  /** Wechselt die Anwesenheits-Auswahl. Abwählen entfernt auch aus einer Gruppe. */
  function toggle(id: string) {
    const wasSelected = selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(id);
      else next.add(id);
      return next;
    });
    if (wasSelected) {
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, playerIds: g.playerIds.filter((pid) => pid !== id) }))
          .filter((g) => g.playerIds.length >= MIN_GROUP_SIZE),
      );
    }
  }

  function startGroupMode() {
    setGroupModeActive(true);
    setPendingGroupMembers([]);
    setGroupModeHint(null);
  }

  function cancelGroupMode() {
    setGroupModeActive(false);
    setPendingGroupMembers([]);
    setGroupModeHint(null);
  }

  /** Eine Gruppe mit weniger als 2 Mitgliedern wird beim Schliessen verworfen. */
  function finishGroupMode() {
    if (pendingGroupMembers.length >= MIN_GROUP_SIZE) {
      setGroups((prev) => [
        ...prev,
        { id: crypto.randomUUID(), playerIds: pendingGroupMembers },
      ]);
    }
    setGroupModeActive(false);
    setPendingGroupMembers([]);
    setGroupModeHint(null);
  }

  function dissolveGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function dissolveAllGroups() {
    setGroups([]);
  }

  const groupedPlayerIds = useMemo(
    () => new Set(groups.flatMap((g) => g.playerIds)),
    [groups],
  );

  /** Tap im Gruppen-Modus: Mitgliedschaft umschalten (Q11: markiert gleich als anwesend). */
  function handleGroupModeTap(playerId: string) {
    if (groupedPlayerIds.has(playerId) && !pendingGroupMembers.includes(playerId)) {
      setGroupModeHint("Ist schon in einer anderen Gruppe.");
      return;
    }
    setGroupModeHint(null);
    setPendingGroupMembers((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= MAX_GROUP_SIZE) {
        setGroupModeHint(`Höchstens ${MAX_GROUP_SIZE} Spieler pro Gruppe.`);
        return prev;
      }
      return [...prev, playerId];
    });
    setSelected((prev) => (prev.has(playerId) ? prev : new Set(prev).add(playerId)));
  }

  function handleRowTap(playerId: string) {
    if (groupModeActive) {
      handleGroupModeTap(playerId);
      return;
    }
    toggle(playerId);
  }

  async function handleAddFormSubmit() {
    if (!newFirstName.trim()) return;
    setAdding(true);
    setAddError(null);
    const { player, error: err } = await createPlayerQuick(
      newFirstName.trim(),
      newLastName.trim() || null,
      newSkill,
    );
    setAdding(false);
    if (err || !player) {
      setAddError(err ?? "Unbekannter Fehler");
      return;
    }
    addToSelection(player);
    setNewFirstName("");
    setNewLastName("");
    setNewSkill(0);
    setShowAddForm(false);
    setSearch("");
  }

  /** Öffnet das Anlege-Formular, vorbefüllt mit dem bisher getippten Suchtext. */
  function openAddForm() {
    const { firstName, lastName } = splitTypedName(search);
    setNewFirstName(firstName);
    setNewLastName(lastName ?? "");
    setNewSkill(0);
    setAddError(null);
    setShowAddForm(true);
  }

  async function computePairing() {
    setError(null);
    setLoading(true);
    setTables(null);
    setSwapPick(null);
    setSelectedForReshuffle(new Set());
    try {
      const res = await fetch("/api/admin/casual/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: [...selected],
          mode,
          groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler");
        return;
      }
      setTables(data.tables);
    } catch {
      setError("Netzwerkfehler beim Berechnen der Zuteilung");
    } finally {
      setLoading(false);
    }
  }

  function handlePlayerClick(tableNumber: number, playerId: string) {
    if (!swapPick) {
      setSwapPick({ table: tableNumber, player: playerId });
      return;
    }
    if (swapPick.player === playerId) {
      setSwapPick(null);
      return;
    }
    if (!tables) return;

    // Tausche die beiden Spieler zwischen (oder innerhalb) der Tische.
    // Bewusst uneingeschränkt möglich, auch wenn es eine Gruppe trennt —
    // der Organisator ist die letzte Instanz (siehe Grill-Notizen Q14).
    const next = tables.map((t) => ({ ...t, players: [...t.players] }));
    const tableA = next.find((t) => t.tableNumber === swapPick.table)!;
    const tableB = next.find((t) => t.tableNumber === tableNumber)!;
    const indexA = tableA.players.findIndex((p) => p.id === swapPick.player);
    const indexB = tableB.players.findIndex((p) => p.id === playerId);
    const tmp = tableA.players[indexA];
    tableA.players[indexA] = tableB.players[indexB];
    tableB.players[indexB] = tmp;

    setTables(next);
    setSwapPick(null);

    // Auch öffentlich übernehmen, damit die Lese-Ansicht dasselbe zeigt.
    void persistCasualPairing(
      next.map((t) => ({
        tableNumber: t.tableNumber,
        playerIds: t.players.map((p) => p.id),
      })),
    );
  }

  /** Tap auf einen Tisch-Header (de-)markiert ihn für das Neumischen. */
  function toggleTableSelection(tableNumber: number) {
    // Ein offener Einzeltausch und die Mehrfachauswahl fürs Neumischen
    // bleiben zwei getrennte Interaktionen — sonst könnten zwei
    // unabhängige Klick-Ketten sich vermischen.
    setSwapPick(null);
    setSelectedForReshuffle((prev) => {
      const next = new Set(prev);
      if (next.has(tableNumber)) next.delete(tableNumber);
      else next.add(tableNumber);
      return next;
    });
  }

  /**
   * Mischt die Belegung der ausgewählten Tische untereinander neu, ohne
   * die übrigen Tische oder Tischgrößen anzufassen. `keepGroups` wird bei
   * jedem Durchgang bewusst neu entschieden (kein fester Modus).
   */
  async function reshuffleSelected(keepGroups: boolean) {
    if (!tables || selectedForReshuffle.size < 2) return;
    setError(null);
    setReshuffling(true);
    try {
      const res = await fetch("/api/admin/casual/reshuffle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: tables.map((t) => ({
            tableNumber: t.tableNumber,
            playerIds: t.players.map((p) => p.id),
          })),
          tableNumbers: [...selectedForReshuffle],
          mode,
          keepGroups,
          groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unbekannter Fehler");
        return;
      }
      const updatedByNumber = new Map<number, TableResult>(
        (data.tables as TableResult[]).map((t) => [t.tableNumber, t]),
      );
      setTables((prev) =>
        prev ? prev.map((t) => updatedByNumber.get(t.tableNumber) ?? t) : prev,
      );
      setSelectedForReshuffle(new Set());
    } catch {
      setError("Netzwerkfehler beim Neumischen");
    } finally {
      setReshuffling(false);
    }
  }

  /** Verwirft die Zuteilung. Spielerauswahl und Gruppen bleiben bewusst stehen. */
  function handleReset() {
    setTables(null);
    setSwapPick(null);
    setSelectedForReshuffle(new Set());
    setError(null);
    void resetCasualPairing();
  }

  const allPlayersSorted = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

  // Eine einzige, stabil alphabetische Liste — die Suche filtert alle
  // Einträge gleich, unabhängig von der Auswahl. Antippen ändert nur den
  // Zustand des Eintrags, nie seine Position (siehe Grill-Notizen Q2/Q4).
  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPlayersSorted;
    return allPlayersSorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [allPlayersSorted, search]);

  // Mindesthöhe für die Liste, reserviert für den vollen (ungefilterten)
  // Bestand in der jeweils aktuellen Spaltenzahl (Worst Case) — sonst
  // schrumpft die Seite bei jedem Tastendruck im Suchfeld mit der Anzahl
  // Treffer und die Ansicht springt hin und her, weil der sichtbare
  // Ausschnitt bei jedem Tastendruck neu berechnet wird. ROW_HEIGHT/GAP
  // entsprechen den Tailwind-Klassen `min-h-11`/`gap-2` der Kacheln unten.
  // Mobil (2 Spalten) und Desktop (`sm:grid-cols-3`, 3 Spalten) reservieren
  // unterschiedlich viele Zeilen — beide Werte werden berechnet und die
  // Umschaltung passiert per CSS-Custom-Property an derselben Breakpoint-
  // Grenze wie `sm:grid-cols-3`, ohne ResizeObserver/matchMedia in JS.
  const listMinHeight = useMemo(() => {
    const ROW_HEIGHT = 44;
    const ROW_GAP = 8;
    const heightForColumns = (columns: number) => {
      const rows = Math.ceil(allPlayersSorted.length / columns);
      return rows > 0 ? rows * ROW_HEIGHT + (rows - 1) * ROW_GAP : 0;
    };
    return { mobile: heightForColumns(2), desktop: heightForColumns(3) };
  }, [allPlayersSorted.length]);

  const nameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const playerGroupIndex = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach((g, i) => {
      for (const pid of g.playerIds) map.set(pid, i);
    });
    return map;
  }, [groups]);

  // Tischgrössen live mitrechnen, damit ein Gruppen-Konflikt sofort
  // erkennbar ist — bevor überhaupt "Tische berechnen" gedrückt wird
  // (siehe Grill-Notizen Q12). computeTableSizes ist eine reine Funktion
  // ohne Server-Abhängigkeit, daher direkt im Client nutzbar.
  const tableSizes = useMemo(() => {
    if (selectedCount < 3) return null;
    try {
      return computeTableSizes(selectedCount);
    } catch {
      return null;
    }
  }, [selectedCount]);

  const groupConflict = useMemo(() => {
    if (!tableSizes || groups.length === 0) return null;
    return describeGroupConflict(
      groups.map((g, i) => ({ id: g.id, label: groupLabel(i), playerIds: g.playerIds })),
      tableSizes,
    );
  }, [tableSizes, groups]);

  // Gruppen, deren Mitglieder vollständig auf den aktuell für das
  // selektive Neumischen ausgewählten Tischen sitzen (siehe Grill-Notizen:
  // eine Gruppe kann per Definition nie über zwei Tische verteilt sein —
  // sie ist entweder komplett drin oder komplett irrelevant hier).
  const reshuffleSelection = useMemo(() => {
    if (!tables || selectedForReshuffle.size < 2) return null;
    const selectedTables = tables.filter((t) =>
      selectedForReshuffle.has(t.tableNumber),
    );
    if (selectedTables.length !== selectedForReshuffle.size) return null;
    const sizes = selectedTables.map((t) => t.players.length);
    const playerIdSet = new Set(
      selectedTables.flatMap((t) => t.players.map((p) => p.id)),
    );
    const applicableGroups = groups
      .map((g, i) => ({ ...g, label: groupLabel(i) }))
      .filter((g) => g.playerIds.every((id) => playerIdSet.has(id)));
    return { sizes, applicableGroups };
  }, [tables, selectedForReshuffle, groups]);

  const reshuffleGroupConflict = useMemo(() => {
    if (!reshuffleSelection || reshuffleSelection.applicableGroups.length === 0) {
      return null;
    }
    return describeGroupConflict(
      reshuffleSelection.applicableGroups,
      reshuffleSelection.sizes,
    );
  }, [reshuffleSelection]);

  return (
    <div className="flex flex-col gap-8">
      {/* Die fertige Zuteilung steht bewusst zuoberst — beim Spielabend
          schaut man darauf, nicht auf die Auswahlliste darunter. */}
      {tables && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-medium">
              Tischzuteilung — klicke zwei Spieler an, um sie zu tauschen
            </h2>
            <button
              type="button"
              onClick={handleReset}
              className="min-h-11 rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
            >
              Zurücksetzen
            </button>
          </div>
          <p className="text-xs opacity-70">
            Diese Zuteilung ist auf der öffentlichen Pairing-Seite sichtbar.
            &quot;Zurücksetzen&quot; nimmt sie dort wieder weg; deine
            Spielerauswahl und Gruppen bleiben erhalten. Tippe auf einen
            Tisch-Titel, um ihn für ein selektives Neumischen auszuwählen
            (mindestens 2 Tische).
          </p>
          <div className="flex flex-wrap gap-4">
            {tables.map((table) => {
              const isSelectedForReshuffle = selectedForReshuffle.has(
                table.tableNumber,
              );
              return (
                <div
                  key={table.tableNumber}
                  className={`w-full rounded border p-3 sm:w-48 ${
                    isSelectedForReshuffle
                      ? "border-blue-500 bg-blue-500/5"
                      : "border-black/20 dark:border-white/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTableSelection(table.tableNumber)}
                    className="mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded text-left text-sm font-semibold"
                  >
                    <span>
                      Tisch {table.tableNumber} ({table.size} Spieler)
                    </span>
                    {isSelectedForReshuffle && (
                      <span className="shrink-0 text-xs font-normal text-blue-600 dark:text-blue-400">
                        ausgewählt
                      </span>
                    )}
                  </button>
                  <ul className="flex flex-col gap-1.5">
                    {table.players.map((p) => {
                      const isPicked = swapPick?.player === p.id;
                      const groupIndex = playerGroupIndex.get(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handlePlayerClick(table.tableNumber, p.id)}
                            className={`flex min-h-11 w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
                              isPicked
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-black/10 dark:border-white/10"
                            }`}
                          >
                            <span className="truncate flex-1">{p.name}</span>
                            {groupIndex !== undefined && (
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${groupBadgeColor(groupIndex)}`}
                              >
                                {groupLabel(groupIndex)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {selectedForReshuffle.size > 0 && (
            <div className="flex flex-col gap-2">
              {selectedForReshuffle.size === 1 && (
                <p className="text-xs opacity-70">
                  Noch einen zweiten Tisch auswählen, um sie untereinander
                  neu zu mischen.
                </p>
              )}
              {selectedForReshuffle.size >= 2 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={reshuffling || !!reshuffleGroupConflict}
                    onClick={() => reshuffleSelected(true)}
                    className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {reshuffling ? "Mische…" : "Gruppen behalten"}
                  </button>
                  <button
                    type="button"
                    disabled={reshuffling}
                    onClick={() => reshuffleSelected(false)}
                    className="min-h-11 rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
                  >
                    {reshuffling ? "Mische…" : "Gruppen auflösen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedForReshuffle(new Set())}
                    className="min-h-11 rounded border border-transparent px-3 py-2 text-sm opacity-70"
                  >
                    Auswahl aufheben
                  </button>
                </div>
              )}
              {reshuffleGroupConflict && (
                <p className="text-xs text-red-600">
                  {reshuffleGroupConflict.message}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          Anwesende Spieler auswählen ({selectedCount})
        </h2>

        <label className="flex flex-col gap-1.5 text-sm">
          Spieler suchen
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name eingeben…"
            className="min-h-9 w-full max-w-sm rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>

        {/* Fester Trigger direkt unter dem Suchfeld — bleibt immer an
            derselben Stelle erreichbar, unabhängig von der Länge der
            darunter angezeigten Liste. */}
        {!showAddForm && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex min-h-11 w-fit items-center rounded border border-dashed border-black/20 px-3 py-2 text-left text-sm dark:border-white/20"
          >
            {search.trim()
              ? `+ „${search.trim()}“ als neuen Spieler anlegen`
              : "+ Neuen Spieler erfassen"}
          </button>
        )}

        {showAddForm && (
          <div className="flex flex-wrap items-end gap-3 rounded border border-dashed border-black/20 p-3 dark:border-white/20">
            <label className="flex flex-col gap-1.5 text-xs">
              Vorname
              <input
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="min-h-9 w-28 rounded border border-black/20 px-3 py-2 dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              Nachname (optional)
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="min-h-9 w-28 rounded border border-black/20 px-3 py-2 dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              Elo (0-3)
              <select
                value={newSkill}
                onChange={(e) => setNewSkill(Number(e.target.value))}
                className="min-h-9 w-20 rounded border border-black/20 px-3 py-2 dark:border-white/20"
              >
                {SKILL_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleAddFormSubmit}
              disabled={!newFirstName.trim() || adding}
              className="min-h-11 rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
            >
              {adding ? "Lege an…" : "Anlegen"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-11 rounded border border-transparent px-4 py-2 text-sm opacity-70"
            >
              Abbrechen
            </button>
          </div>
        )}
        {addError && <p className="text-sm text-red-600">{addError}</p>}

        {groupModeActive && (
          <div className="flex flex-col gap-2 rounded border border-amber-500 bg-amber-500/10 p-3">
            <p className="text-sm">
              Gruppe bilden: tippe die Spieler an, die zusammen sitzen sollen
              ({pendingGroupMembers.length}/{MAX_GROUP_SIZE}).
            </p>
            {groupModeHint && (
              <p className="text-xs text-red-600">{groupModeHint}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={finishGroupMode}
                disabled={pendingGroupMembers.length < MIN_GROUP_SIZE}
                className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                Fertig
              </button>
              <button
                type="button"
                onClick={cancelGroupMode}
                className="min-h-11 rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Eine einzige Liste: Antippen ändert nur den Zustand des
            Eintrags an seiner Position, nichts springt (siehe
            Grill-Notizen Q2). Im Gruppen-Modus nimmt ein Tap den Spieler
            statt in die Gruppe auf. */}
        <div
          className="grid max-w-2xl min-h-[var(--list-min-height-mobile)] grid-cols-2 content-start gap-2 sm:min-h-[var(--list-min-height-desktop)] sm:grid-cols-3"
          style={
            {
              "--list-min-height-mobile": `${listMinHeight.mobile}px`,
              "--list-min-height-desktop": `${listMinHeight.desktop}px`,
            } as CSSProperties
          }
        >
          {filteredPlayers.map((p) => {
            const isSelected = selected.has(p.id);
            const isPending = groupModeActive && pendingGroupMembers.includes(p.id);
            const groupIndex = playerGroupIndex.get(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleRowTap(p.id)}
                className={`flex min-h-11 w-full items-center gap-1.5 rounded border px-3 py-2 text-left text-sm ${
                  isPending
                    ? "border-amber-500 bg-amber-500/10"
                    : isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-black/10 dark:border-white/10"
                }`}
              >
                <span className="w-4 shrink-0">{isSelected ? "✓" : ""}</span>
                <span className="truncate flex-1">{p.name}</span>
                {groupIndex !== undefined && (
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${groupBadgeColor(groupIndex)}`}
                  >
                    {groupLabel(groupIndex)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!groupModeActive && (
          <button
            type="button"
            onClick={startGroupMode}
            className="flex min-h-11 w-fit items-center rounded border border-dashed border-black/20 px-3 py-2 text-left text-sm dark:border-white/20"
          >
            + Gruppe bilden
          </button>
        )}

        {groups.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium opacity-70">Gruppen</span>
              <button
                type="button"
                onClick={dissolveAllGroups}
                className="flex min-h-9 items-center text-xs underline opacity-70"
              >
                alle auflösen
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {groups.map((g, i) => (
                <li
                  key={g.id}
                  className="flex min-h-11 items-center gap-2 rounded border border-black/10 px-3 py-2 dark:border-white/10"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${groupBadgeColor(i)}`}
                  >
                    {groupLabel(i)}
                  </span>
                  <span className="truncate flex-1 text-sm">
                    {g.playerIds.map((id) => nameById.get(id) ?? "?").join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => dissolveGroup(g.id)}
                    aria-label={`Gruppe ${groupLabel(i)} auflösen`}
                    className="flex min-h-11 w-11 shrink-0 items-center justify-center text-lg opacity-70"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {groupConflict && (
          <p className="text-sm text-red-600">{groupConflict.message}</p>
        )}

        <fieldset className="mt-1 flex flex-wrap items-center gap-4 text-sm">
          <legend className="mb-1 text-xs font-medium opacity-70">
            Zuteilungsart
          </legend>
          <label className="flex min-h-9 items-center gap-1.5">
            <input
              type="radio"
              name="mode"
              checked={mode === "random"}
              onChange={() => setMode("random")}
              className="h-4 w-4"
            />
            Zufällig
          </label>
          <label className="flex min-h-9 items-center gap-1.5">
            <input
              type="radio"
              name="mode"
              checked={mode === "skill"}
              onChange={() => setMode("skill")}
              className="h-4 w-4"
            />
            Nach Elo balanciert
          </label>
        </fieldset>

        <button
          type="button"
          disabled={selectedCount < 3 || loading || !!groupConflict}
          onClick={computePairing}
          className="mt-2 min-h-11 w-fit rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {loading ? "Berechne…" : "Tische berechnen"}
        </button>
        {selectedCount > 0 && selectedCount < 3 && (
          <p className="text-xs opacity-70">Mindestens 3 Spieler nötig.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
