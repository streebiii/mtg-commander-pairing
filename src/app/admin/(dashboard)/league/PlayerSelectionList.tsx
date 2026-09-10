"use client";

import { useState } from "react";

interface PlayerOption {
  id: string;
  name: string;
  points: number;
}

/**
 * Anwesenheits-Auswahl beim Start eines Liga-Abends.
 *
 * Ein Umschalter markiert alle Liga-teilnehmenden Spieler auf einmal —
 * bei fast vollständiger Anwesenheit muss der Organisator dann nur noch
 * die paar fehlenden abwählen, statt jeden einzeln anzutippen (siehe
 * BACKLOG.md "Liga: Knopf 'alle Spieler auswählen'"). Zeigt "Auswahl
 * aufheben", sobald bereits alle angehakt sind, sonst "Alle auswählen".
 *
 * Die Checkboxen bleiben normale `name="playerIds"`-Felder im
 * umgebenden `<form action={startEvening}>` der Server-Komponente —
 * nur der Ankreuz-Zustand wird hier clientseitig verwaltet, damit der
 * Umschalter ihn setzen kann.
 */
export default function PlayerSelectionList({
  players,
}: {
  players: PlayerOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = players.length > 0 && selected.size === players.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(players.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggleAll}
        className="flex min-h-11 w-fit items-center rounded border border-white/20 px-4 py-2 text-sm"
      >
        {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
      </button>
      <div className="flex max-w-2xl flex-wrap gap-2">
        {players.map((p) => (
          <label
            key={p.id}
            className="flex min-h-11 items-center gap-1.5 rounded border border-white/20 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              name="playerIds"
              value={p.id}
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              className="h-4 w-4"
            />
            {p.name} ({p.points})
          </label>
        ))}
      </div>
    </div>
  );
}
