"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import {
  PlayerSearchField,
  PlayerTile,
  PlayerTileGrid,
  usePlayerSearch,
} from "@/components/PlayerPicker";

interface PlayerOption {
  id: string;
  name: string;
  points: number;
}

/**
 * Anwesenheits-Auswahl beim Start eines Liga-Abends — dieselbe Liste wie
 * im Casual-Tab (Suche, Enter wählt den einzigen Treffer), plus ein
 * Umschalter für alle: bei fast vollständiger Anwesenheit wählt der
 * Organisator dann nur noch die paar fehlenden ab. Neue Spieler werden
 * hier bewusst nicht angelegt — Liga-Teilnehmende kommen über den Import
 * oder den Spieler-Tab.
 *
 * Die Auswahl geht als versteckte `playerIds`-Felder an das umgebende
 * `<form action={startEvening}>` — unabhängig davon, ob ein Spieler
 * gerade von der Suche ausgefiltert ist.
 */
export default function PlayerSelectionList({
  players,
}: {
  players: PlayerOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Liest den Pending-Zustand des umgebenden <form> mit.
  const { pending } = useFormStatus();
  const { search, setSearch, filtered, enterTarget } = usePlayerSearch(players);

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

  /** Enter: den einzigen Treffer auswählen (nie abwählen) und weitertippen. */
  function handleEnter() {
    if (!enterTarget) return;
    setSelected((prev) => new Set(prev).add(enterTarget.id));
    setSearch("");
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <PlayerSearchField value={search} onChange={setSearch} onEnter={handleEnter} />
      <SecondaryButton onClick={toggleAll} className="w-fit" disabled={pending}>
        {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
      </SecondaryButton>
      <PlayerTileGrid totalCount={players.length}>
        {filtered.map((p) => (
          <PlayerTile
            key={p.id}
            name={p.name}
            detail={`(${p.points})`}
            selected={selected.has(p.id)}
            enterTarget={p.id === enterTarget?.id}
            disabled={pending}
            onClick={() => toggle(p.id)}
          />
        ))}
      </PlayerTileGrid>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="playerIds" value={id} />
      ))}
      <PrimaryButton
        type="submit"
        className="w-fit"
        disabled={selected.size < 3}
        loading={pending}
      >
        {pending ? "Starte…" : `Abend starten — Runde 1 berechnen (${selected.size})`}
      </PrimaryButton>
    </div>
  );
}
