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

  // Fester "Neuen Spieler erfassen"-Button oben an der Liste, öffnet ein
  // kleines Formular (Vorname/Nachname/Skill).
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
  }

  async function handleQuickCreateFromSearch() {
    const { firstName, lastName } = splitTypedName(search);
    if (!firstName) return;
    setAdding(true);
    setAddError(null);
    const { player, error: err } = await createPlayerQuick(firstName, lastName, 0);
    setAdding(false);
    if (err || !player) {
      setAddError(err ?? "Unbekannter Fehler");
      return;
    }
    addToSelection(player);
    setSearch("");
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

  const showInlineCreate = search.trim() !== "" && searchResults.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Anwesende Spieler auswählen ({selectedCount})
        </h2>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="w-fit rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20"
        >
          {showAddForm ? "Abbrechen" : "+ Neuen Spieler erfassen"}
        </button>

        {showAddForm && (
          <div className="flex flex-wrap items-end gap-2 rounded border border-dashed border-black/20 p-2 dark:border-white/20">
            <label className="flex flex-col gap-1 text-xs">
              Vorname
              <input
                type="text"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="w-28 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Nachname (optional)
              <input
                type="text"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="w-28 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Skill (0-3)
              <select
                value={newSkill}
                onChange={(e) => setNewSkill(Number(e.target.value))}
                className="w-44 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
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
              className="rounded border border-black/20 px-3 py-1.5 text-sm dark:border-white/20 disabled:opacity-40"
            >
              {adding ? "Lege an…" : "Anlegen"}
            </button>
          </div>
        )}
        {addError && <p className="text-sm text-red-600">{addError}</p>}

        {selectedPlayers.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium opacity-70">
              Ausgewählt ({selectedPlayers.length})
            </div>
            <div className="flex max-w-2xl flex-wrap gap-2">
              {selectedPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-1 rounded border border-blue-500 bg-blue-500/10 px-3 py-2 text-sm"
                >
                  ✓ {p.name}{" "}
                  <span className="opacity-60">({skillLevelShortLabel(p.skillLevel)})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Spieler suchen
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name eingeben…"
            className="w-full max-w-sm rounded border border-black/20 px-3 py-2 dark:border-white/20"
          />
        </label>

        <div className="flex max-w-2xl flex-col gap-1">
          {searchResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-left text-sm dark:border-white/10"
            >
              <span>{p.name}</span>
              <span className="opacity-60">{skillLevelShortLabel(p.skillLevel)}</span>
            </button>
          ))}
          {showInlineCreate && (
            <button
              type="button"
              onClick={handleQuickCreateFromSearch}
              disabled={adding}
              className="rounded border border-dashed border-black/20 px-3 py-2 text-left text-sm dark:border-white/20 disabled:opacity-40"
            >
              {adding ? "Lege an…" : `„${search.trim()}“ als neuen Spieler anlegen`}
            </button>
          )}
        </div>

        <fieldset className="mt-1 flex items-center gap-4 text-sm">
          <legend className="mb-1 text-xs font-medium opacity-70">
            Zuteilungsart
          </legend>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              checked={mode === "random"}
              onChange={() => setMode("random")}
            />
            Zufällig
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="mode"
              checked={mode === "skill"}
              onChange={() => setMode("skill")}
            />
            Nach Skill balanciert
          </label>
        </fieldset>

        <button
          type="button"
          disabled={selectedCount < 3 || loading}
          onClick={computePairing}
          className="mt-2 w-fit rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
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
                <ul className="flex flex-col gap-1">
                  {table.players.map((p) => {
                    const isPicked = swapPick?.player === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => handlePlayerClick(table.tableNumber, p.id)}
                          className={`w-full rounded border px-2 py-1 text-left text-sm ${
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
