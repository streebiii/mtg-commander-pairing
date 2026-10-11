"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/Button";
import {
  PlayerSearchField,
  PlayerTile,
  PlayerTileGrid,
  usePlayerSearch,
} from "@/components/PlayerPicker";
import TableCard from "@/components/TableCard";
import { SKILL_LEVELS } from "@/lib/players";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import {
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  describeGroupConflict,
  type PlayerGroup,
} from "@/lib/pairing/groups";
import { quickCreatePlayer } from "../players/actions";
import {
  computeCasual,
  publishCasual,
  reshuffleCasual,
  resetCasual,
  saveCasualSwap,
  type CasualTable,
} from "./actions";

// Bewusst ohne Stufe: die braucht nur der Server zum Rechnen, und was
// nicht im Browser ist, kann auch niemand mitlesen (siehe SPEC.md 6.1).
interface PlayerOption {
  id: string;
  name: string;
}

type Mode = "random" | "skill";

/**
 * Zustand von Auswahl, Gruppen und Einstellungen wird nur im Browser
 * gehalten (siehe Grill-Notizen) — keine Datenbank-Tabelle, keine
 * Migration. Alles zusammen unter einem Schlüssel, damit nach einem
 * Reload ein in sich konsistenter Stand geladen wird (nie eine Gruppe,
 * deren Mitglieder gar nicht als anwesend markiert sind).
 *
 * Die Zuteilungsart gehört seit dem Wiederherstellen der Tische dazu:
 * sonst stünde nach einem Reload wieder "Zufällig", und ein selektives
 * Neumischen der wiederhergestellten Tische liefe stillschweigend im
 * falschen Modus (siehe `reshuffleSelected`).
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

/** Farbiges Gruppen-Kürzel (A, B, C, …) an Listeneinträgen und Tischen. */
function GroupBadge({ index }: { index: number }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${groupBadgeColor(index)}`}
    >
      {groupLabel(index)}
    </span>
  );
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
  initialTables,
  initialPublished,
}: {
  players: PlayerOption[];
  /**
   * Die zuletzt gespeicherte Zuteilung, sofern sie jung genug ist (siehe
   * `getCasualPairing()`). Dadurch überlebt sie einen Reload der
   * Admin-Seite, ohne dass hier etwas zusätzlich persistiert werden muss.
   */
  initialTables: CasualTable[] | null;
  /** Ob diese Zuteilung schon live geschaltet ist. */
  initialPublished: boolean;
}) {
  const [players, setPlayers] = useState<PlayerOption[]>(initialPlayers);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<PlayerGroup[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { search, setSearch, filtered, enterTarget, noMatch } =
    usePlayerSearch(players);
  const [mode, setMode] = useState<Mode>("random");
  // Ein einzelner 5er-Tisch, wo er die Verteilung verbessert (siehe SPEC.md
  // Abschnitt 3.1). Standard aus, damit sich ohne Zutun nichts ändert.
  const [allowFiveTable, setAllowFiveTable] = useState(false);
  const [tables, setTables] = useState<CasualTable[] | null>(initialTables);
  // Warteraum wie in der Liga: eine neue Zuteilung sieht erst nach «Live
  // schalten» jemand ausser dem Organisator (siehe SPEC.md Abschnitt 4.3).
  const [published, setPublished] = useState(initialPublished);
  const [publishing, setPublishing] = useState(false);
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
  // (Vorname/Nachname/Stufe), vorbefüllt mit dem getippten Suchtext.
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newSkill, setNewSkill] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
        mode?: unknown;
        allowFiveTable?: unknown;
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
      setMode(parsed.mode === "skill" ? "skill" : "random");
      setAllowFiveTable(parsed.allowFiveTable === true);
    } catch {
      // Ungültiger/korrupter Zustand im Speicher — einfach frisch starten.
    } finally {
      setHydrated(true);
    }
    // Nur beim ersten Rendern laden, initialPlayers ändert sich hier nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auswahl + Gruppen + Zuteilungsart bei jeder Änderung sichern (erst
  // nach dem Laden, sonst würde der leere Anfangszustand den
  // gespeicherten überschreiben).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedIds: [...selected],
        groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
        mode,
        allowFiveTable,
      }),
    );
  }, [hydrated, selected, groups, mode, allowFiveTable]);

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
    let result: Awaited<ReturnType<typeof quickCreatePlayer>>;
    try {
      result = await quickCreatePlayer({
        firstName: newFirstName,
        lastName: newLastName,
        skillLevel: newSkill,
      });
    } catch {
      result = { error: "Fehler beim Anlegen" };
    }
    setAdding(false);
    if ("error" in result) {
      setAddError(result.error);
      return;
    }
    addToSelection(result.player);
    setNewFirstName("");
    setNewLastName("");
    setNewSkill(0);
    setShowAddForm(false);
    setSearch("");
    // Zurück ins Suchfeld: mit dem Schliessen des Formulars verschwindet
    // das fokussierte Feld aus dem DOM, der Fokus fiele sonst auf <body>
    // und die Kette "tippen, Enter, nächster Name" wäre unterbrochen.
    searchRef.current?.focus();
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

  // Beim Öffnen des Formulars gleich ins Vornamen-Feld springen. Damit
  // führt die Enter-Kette aus dem Suchfeld ohne Mausgriff weiter: tippen,
  // Enter (Formular öffnet), Enter (Spieler ist angelegt und ausgewählt).
  useEffect(() => {
    if (showAddForm) firstNameRef.current?.focus();
  }, [showAddForm]);

  /** Enter in den Namensfeldern legt den Spieler an, wie der Knopf "Anlegen". */
  function handleAddFormKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!newFirstName.trim() || adding) return;
    void handleAddFormSubmit();
  }

  async function computePairing() {
    setError(null);
    setLoading(true);
    setTables(null);
    setSwapPick(null);
    setSelectedForReshuffle(new Set());
    try {
      const result = await computeCasual({
        playerIds: [...selected],
        mode,
        allowFiveTable,
        groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setTables(result.tables);
      setPublished(false);
    } catch {
      setError("Fehler beim Berechnen der Zuteilung");
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

    // Speichern — ist die Zuteilung schon live, sieht die öffentliche
    // Seite den Tausch sofort.
    void saveCasualSwap(
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
      const result = await reshuffleCasual({
        tables: tables.map((t) => ({
          tableNumber: t.tableNumber,
          playerIds: t.players.map((p) => p.id),
        })),
        tableNumbers: [...selectedForReshuffle],
        mode,
        keepGroups,
        groups: groups.map((g) => ({ id: g.id, playerIds: g.playerIds })),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const updatedByNumber = new Map(
        result.tables.map((t) => [t.tableNumber, t]),
      );
      setTables((prev) =>
        prev ? prev.map((t) => updatedByNumber.get(t.tableNumber) ?? t) : prev,
      );
      setSelectedForReshuffle(new Set());
    } catch {
      setError("Fehler beim Neumischen");
    } finally {
      setReshuffling(false);
    }
  }

  /** Verwirft die Zuteilung. Spielerauswahl und Gruppen bleiben bewusst stehen. */
  function handleReset() {
    setTables(null);
    setPublished(false);
    setSwapPick(null);
    setSelectedForReshuffle(new Set());
    setError(null);
    void resetCasual();
  }

  /** «Live schalten»: ab jetzt zeigt die öffentliche Seite die Tische. */
  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      await publishCasual();
      setPublished(true);
    } catch {
      setError("Fehler beim Live schalten");
    } finally {
      setPublishing(false);
    }
  }

  /**
   * Enter im Suchfeld — die Tastatur-Abkürzung für den häufigsten
   * Handgriff am Spielabend: Name tippen, Enter, nächster Name.
   *
   * - Genau ein Treffer: dieser Spieler wird ausgewählt (im Gruppen-Modus
   *   in die entstehende Gruppe aufgenommen) und das Suchfeld geleert, um
   *   direkt den nächsten Namen tippen zu können. Bewusst nur auswählen,
   *   nie abwählen: sonst würde ein zweites Enter aus Versehen den eben
   *   markierten Spieler wieder entfernen.
   * - Kein Treffer: das Anlege-Formular öffnet sich, vorbefüllt mit dem
   *   getippten Namen.
   * - Mehrere Treffer: nichts, es wäre nicht entscheidbar, wer gemeint ist.
   */
  function handleSearchEnter() {
    if (enterTarget) {
      if (groupModeActive) handleGroupModeTap(enterTarget.id);
      else if (!selected.has(enterTarget.id)) toggle(enterTarget.id);
      setSearch("");
      return;
    }
    if (noMatch) openAddForm();
  }

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
      return computeTableSizes(selectedCount, { allowFiveTable });
    } catch {
      return null;
    }
  }, [selectedCount, allowFiveTable]);

  /**
   * Was der 5er-Haken bei der aktuellen Spielerzahl bewirkt. Ohne diesen
   * Hinweis wäre am Spielabend nicht erkennbar, ob er überhaupt greift —
   * betroffen sind nur Spielerzahlen mit N ≡ 1 (mod 4), bei 10 oder 14
   * ändert er nichts.
   */
  const fiveTableHint = useMemo(() => {
    if (selectedCount < 3) return null;
    try {
      const ohne = computeTableSizes(selectedCount).join("+");
      const mit = computeTableSizes(selectedCount, {
        allowFiveTable: true,
      }).join("+");
      if (ohne === mit) {
        return `Bei ${selectedCount} Spielern ändert das nichts: ${ohne}.`;
      }
      return `${selectedCount} Spieler: ${mit} statt ${ohne}.`;
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

  /** Wie viele Gruppen sitzen vollständig auf den gewählten Tischen? */
  const betroffeneGruppen = reshuffleSelection?.applicableGroups.length ?? 0;

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      {/* Linke Spalte (3 von 4): erst die Zuteilung, darunter die Auswahl.
          Die rechte Spalte steht daneben und reicht dadurch bis ganz nach
          oben neben die Zuteilung. */}
      <div className="flex flex-col gap-8 lg:col-span-3">
      {/* Die fertige Zuteilung steht bewusst zuoberst — beim Spielabend
          schaut man darauf, nicht auf die Auswahlliste darunter. */}
      {tables && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-medium">
              Tischzuteilung — {published ? "live" : "Warteraum"}
            </h2>
            {!published && (
              <PrimaryButton loading={publishing} onClick={handlePublish}>
                {publishing ? "Schalte live…" : "Live schalten"}
              </PrimaryButton>
            )}
          </div>
          <p className="text-xs opacity-70">
            {published
              ? "Diese Zuteilung ist auf der öffentlichen Pairing-Seite sichtbar. Änderungen erscheinen dort sofort."
              : "Diese Zuteilung ist noch nicht öffentlich sichtbar. Prüfe sie und passe sie an, dann „Live schalten“."}{" "}
            Tippe zwei Spieler an, um sie zu tauschen, oder einen Tisch-Titel,
            um ihn für ein selektives Neumischen auszuwählen (mindestens 2
            Tische).
          </p>
          <div className="flex flex-wrap gap-4">
            {tables.map((table) => {
              const isSelectedForReshuffle = selectedForReshuffle.has(
                table.tableNumber,
              );
              return (
                <TableCard
                  key={table.tableNumber}
                  tableNumber={table.tableNumber}
                  size={table.size}
                  tone={isSelectedForReshuffle ? "selected" : "default"}
                  onTitleClick={() => toggleTableSelection(table.tableNumber)}
                  aside={
                    isSelectedForReshuffle && (
                      <span className="text-blue-400">ausgewählt</span>
                    )
                  }
                >
                  <ul className="flex flex-col gap-1.5">
                    {table.players.map((p) => {
                      const isPicked = swapPick?.player === p.id;
                      const groupIndex = playerGroupIndex.get(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handlePlayerClick(table.tableNumber, p.id)}
                            className={`flex min-h-11 w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors ${
                              isPicked
                                ? "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                                : "border-white/10 hover:bg-white/5"
                            }`}
                          >
                            <span className="truncate flex-1">{p.name}</span>
                            {groupIndex !== undefined && <GroupBadge index={groupIndex} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </TableCard>
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
                  {/* Die Unterscheidung "behalten oder auflösen" ergibt nur
                      Sinn, wenn auf den gewählten Tischen überhaupt eine
                      Gruppe sitzt — sonst täten beide Knöpfe dasselbe. */}
                  {betroffeneGruppen > 0 ? (
                    <>
                      <PrimaryButton
                        disabled={!!reshuffleGroupConflict}
                        loading={reshuffling}
                        onClick={() => reshuffleSelected(true)}
                      >
                        {reshuffling ? "Mische…" : "Gruppen behalten"}
                      </PrimaryButton>
                      <SecondaryButton
                        loading={reshuffling}
                        onClick={() => reshuffleSelected(false)}
                      >
                        {reshuffling ? "Mische…" : "Gruppen auflösen"}
                      </SecondaryButton>
                    </>
                  ) : (
                    <PrimaryButton loading={reshuffling} onClick={() => reshuffleSelected(true)}>
                      {reshuffling ? "Mische…" : "Neu mischen"}
                    </PrimaryButton>
                  )}
                  <SecondaryButton onClick={() => setSelectedForReshuffle(new Set())}>
                    Auswahl aufheben
                  </SecondaryButton>
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

          <PlayerSearchField
            value={search}
            onChange={setSearch}
            onEnter={handleSearchEnter}
            inputRef={searchRef}
          />

          {/* Fester Trigger direkt unter dem Suchfeld — bleibt immer an
              derselben Stelle erreichbar, unabhängig von der Länge der
              darunter angezeigten Liste. */}
          {!showAddForm && (
            <button
              type="button"
              onClick={openAddForm}
              className={`flex min-h-11 w-fit items-center gap-2 rounded border border-dashed border-white/20 px-3 py-2 text-left text-sm ${
                noMatch ? "ring-2 ring-foreground/60" : ""
              }`}
            >
              <span>
                {search.trim()
                  ? `+ „${search.trim()}“ als neuen Spieler anlegen`
                  : "+ Neuen Spieler erfassen"}
              </span>
              {noMatch && (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xs opacity-70"
                  title="Enter öffnet das Anlege-Formular"
                >
                  ↵
                </span>
              )}
            </button>
          )}

          {showAddForm && (
            <div className="flex flex-wrap items-end gap-3 rounded border border-dashed border-white/20 p-3">
              <label className="flex flex-col gap-1.5 text-xs">
                Vorname
                <input
                  ref={firstNameRef}
                  type="text"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  onKeyDown={handleAddFormKeyDown}
                  className="min-h-9 w-28 rounded border border-white/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs">
                Nachname (optional)
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  onKeyDown={handleAddFormKeyDown}
                  className="min-h-9 w-28 rounded border border-white/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs">
                Stufe (0-3)
                <select
                  value={newSkill}
                  onChange={(e) => setNewSkill(Number(e.target.value))}
                  className="min-h-9 w-20 rounded border border-white/20 px-3 py-2"
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <PrimaryButton
                disabled={!newFirstName.trim()}
                loading={adding}
                onClick={handleAddFormSubmit}
              >
                {adding ? "Lege an…" : "Anlegen"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowAddForm(false)}>
                Abbrechen
              </SecondaryButton>
            </div>
          )}
          {addError && <p className="text-sm text-red-600">{addError}</p>}

          {/* Eine einzige Liste: Antippen ändert nur den Zustand des
              Eintrags an seiner Position, nichts springt (siehe
              Grill-Notizen Q2). Im Gruppen-Modus nimmt ein Tap den Spieler
              statt in die Gruppe auf. */}
          <PlayerTileGrid totalCount={players.length}>
            {filtered.map((p) => {
              const groupIndex = playerGroupIndex.get(p.id);
              return (
                <PlayerTile
                  key={p.id}
                  name={p.name}
                  selected={selected.has(p.id)}
                  pending={groupModeActive && pendingGroupMembers.includes(p.id)}
                  enterTarget={p.id === enterTarget?.id}
                  badge={groupIndex !== undefined && <GroupBadge index={groupIndex} />}
                  onClick={() => handleRowTap(p.id)}
                />
              );
            })}
          </PlayerTileGrid>
        </section>
      </div>

      {/* Einstellungen und Aktionen. Ab lg eine eigene Spalte über die
          volle Höhe; darunter stapelt es unter die Auswahl — dort steht
          "Fertig" beim Gruppieren direkt unter der Liste. */}
      {/* Ab lg bleibt die Spalte beim Scrollen stehen und zentriert ihren
          Inhalt vertikal. Höhe und Abstand rechnen das p-6 des
          Admin-Layouts heraus, damit sie exakt in den sichtbaren Bereich
          passt statt oben darüber hinauszulaufen. */}
      {/* Die abgesetzte Fläche (`bg-surface`) zieht die Grenze zur
          Auswahl links. Bewusst erst ab lg: darunter stapeln die Spalten
          untereinander, dort gibt es keine zwei Bereiche nebeneinander,
          die auseinandergehalten werden müssten. */}
      <aside className="flex flex-col gap-4 lg:col-span-1 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start lg:justify-center lg:rounded-lg lg:bg-surface lg:px-4 lg:py-6">
          <h2 className="text-sm font-medium">Einstellungen</h2>

          <div className="flex flex-col gap-2">
            {!groupModeActive && (
              <button
                type="button"
                onClick={startGroupMode}
                className="flex min-h-11 w-full items-center rounded border border-dashed border-white/20 px-3 py-2 text-left text-sm"
              >
                + Gruppe bilden
              </button>
            )}

            {groupModeActive && (
              <div className="flex flex-col gap-2 rounded border border-amber-500 bg-amber-500/10 p-3">
                <p className="text-sm">
                  Gruppe bilden: tippe die Spieler an, die zusammen sitzen sollen
                  ({pendingGroupMembers.length}/{MAX_GROUP_SIZE}).
                </p>
                {groupModeHint && (
                  <p className="text-xs text-red-600">{groupModeHint}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton
                    disabled={pendingGroupMembers.length < MIN_GROUP_SIZE}
                    onClick={finishGroupMode}
                  >
                    Fertig
                  </PrimaryButton>
                  <SecondaryButton onClick={cancelGroupMode}>
                    Abbrechen
                  </SecondaryButton>
                </div>
              </div>
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
                      className="flex min-h-11 items-center gap-2 rounded border border-white/10 px-3 py-2"
                    >
                      <GroupBadge index={i} />
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
          </div>

          <fieldset className="flex flex-col gap-1 text-sm">
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
              Ausgewogen
            </label>
          </fieldset>

          {/* Orthogonal zur Zuteilungsart: beide Kombinationen ergeben Sinn,
              deshalb bewusst eine eigene Checkbox und keine dritte
              Radio-Option. Wirkt erst bei der nächsten Berechnung, genau
              wie die Zuteilungsart. */}
          <div className="flex flex-col gap-1">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowFiveTable}
                onChange={(e) => setAllowFiveTable(e.target.checked)}
                className="h-4 w-4"
              />
              5er-Tisch erlauben
            </label>
            {fiveTableHint && (
              <p className="text-xs opacity-70">{fiveTableHint}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <PrimaryButton
              className="w-full"
              disabled={selectedCount < 3 || !!groupConflict}
              loading={loading}
              onClick={computePairing}
            >
              {loading ? "Berechne…" : "Tische berechnen"}
            </PrimaryButton>
            {tables && (
              <DangerButton className="w-full" onClick={handleReset}>
                Zurücksetzen
              </DangerButton>
            )}
            {selectedCount > 0 && selectedCount < 3 && (
              <p className="text-xs opacity-70">Mindestens 3 Spieler nötig.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </aside>
    </div>
  );
}
