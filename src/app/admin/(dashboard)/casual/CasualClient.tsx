"use client";

import { useMemo, useState } from "react";
import { SKILL_LEVEL_OPTIONS, skillLevelShortLabel } from "@/lib/players";

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
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("random");
  const [tables, setTables] = useState<TableResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapPick, setSwapPick] = useState<{ table: number; player: string } | null>(
    null,
  );

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

  function addToSelection(player: PlayerOption) {
    setPlayers((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));
    setSelected((prev) => new Set(prev).add(player.id));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    try {
      const res = await fetch("/api/admin/casual/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [...selected], mode }),
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
    // Tausche die beiden Spieler zwischen (oder innerhalb) der Tische.
    setTables((prev) => {
      if (!prev) return prev;
      const next = prev.map((t) => ({ ...t, players: [...t.players] }));
      const tableA = next.find((t) => t.tableNumber === swapPick.table)!;
      const tableB = next.find((t) => t.tableNumber === tableNumber)!;
      const indexA = tableA.players.findIndex((p) => p.id === swapPick.player);
      const indexB = tableB.players.findIndex((p) => p.id === playerId);
      const tmp = tableA.players[indexA];
      tableA.players[indexA] = tableB.players[indexB];
      tableB.players[indexB] = tmp;
      return next;
    });
    setSwapPick(null);
  }

  const selectedPlayers = useMemo(
    () =>
      players
        .filter((p) => selected.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players, selected],
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players
      .filter((p) => !selected.has(p.id))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, selected, search]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">
          Anwesende Spieler auswählen ({selectedCount})
        </h2>

        {selectedPlayers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-medium opacity-70">
              Ausgewählt ({selectedPlayers.length})
            </div>
            <div className="flex max-w-2xl flex-wrap gap-2">
              {selectedPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex min-h-11 items-center gap-1 rounded border border-blue-500 bg-blue-500/10 px-3 py-2 text-sm"
                >
                  ✓ {p.name}{" "}
                  <span className="opacity-60">({skillLevelShortLabel(p.skillLevel)})</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
            darunter angezeigten Ergebnisliste. */}
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
                className="min-h-9 w-28 rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              Nachname (optional)
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="min-h-9 w-28 rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs">
              Elo (0-3)
              <select
                value={newSkill}
                onChange={(e) => setNewSkill(Number(e.target.value))}
                className="min-h-9 w-44 rounded border border-black/20 px-3 py-2 text-sm dark:border-white/20"
              >
                {SKILL_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
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

        <div className="flex max-w-2xl flex-col gap-1.5">
          {searchResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex min-h-11 items-center justify-between rounded border border-black/10 px-3 py-2 text-left text-sm dark:border-white/10"
            >
              <span>{p.name}</span>
              <span className="opacity-60">{skillLevelShortLabel(p.skillLevel)}</span>
            </button>
          ))}
        </div>

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
          disabled={selectedCount < 3 || loading}
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

      {tables && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            Tischzuteilung — klicke zwei Spieler an, um sie zu tauschen
          </h2>
          <div className="flex flex-wrap gap-4">
            {tables.map((table) => (
              <div
                key={table.tableNumber}
                className="w-full rounded border border-black/20 p-3 dark:border-white/20 sm:w-48"
              >
                <div className="mb-2 text-sm font-semibold">
                  Tisch {table.tableNumber} ({table.size} Spieler)
                </div>
                <ul className="flex flex-col gap-1.5">
                  {table.players.map((p) => {
                    const isPicked = swapPick?.player === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handlePlayerClick(table.tableNumber, p.id)}
                          className={`flex min-h-11 w-full items-center rounded border px-3 py-2 text-left text-sm ${
                            isPicked
                              ? "border-blue-500 bg-blue-500/10"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {p.name}{" "}
                          <span className="opacity-60">
                            ({skillLevelShortLabel(p.skillLevel)})
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
