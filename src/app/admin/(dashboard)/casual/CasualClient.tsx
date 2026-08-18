"use client";

import { useMemo, useState } from "react";

interface PlayerOption {
  id: string;
  name: string;
}

interface TableResult {
  tableNumber: number;
  size: number;
  players: PlayerOption[];
}

export default function CasualClient({ players }: { players: PlayerOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tables, setTables] = useState<TableResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapPick, setSwapPick] = useState<{ table: number; player: string } | null>(
    null,
  );

  const selectedCount = selected.size;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        body: JSON.stringify({ playerIds: [...selected] }),
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

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">
          Anwesende Spieler auswählen ({selectedCount})
        </h2>
        <div className="flex max-w-2xl flex-wrap gap-2">
          {sortedPlayers.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-1 rounded border border-black/20 px-2 py-1 text-sm dark:border-white/20"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              {p.name}
            </label>
          ))}
        </div>
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
                className="w-48 rounded border border-black/20 p-3 dark:border-white/20"
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
                          {p.name}
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
