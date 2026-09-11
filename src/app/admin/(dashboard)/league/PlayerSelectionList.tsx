"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PrimaryButton, SecondaryButton } from "@/components/Button";

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
  // useFormStatus liest den Pending-Zustand des umgebenden <form> mit —
  // funktioniert, weil diese Komponente als Kind des Formulars in
  // page.tsx gerendert wird (gleiches Muster wie SubmitButton in
  // admin/login/CodeForm.tsx).
  const { pending } = useFormStatus();

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
      <SecondaryButton onClick={toggleAll} className="w-fit" disabled={pending}>
        {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
      </SecondaryButton>
      {/* Gleichmässiges Raster statt loser flex-wrap-Chips — analog zur
          Spielerliste im Casual-Tab, damit alle Kacheln dieselbe Breite
          haben statt sich nach der Namenslänge zu richten. */}
      <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
        {players.map((p) => (
          <label
            key={p.id}
            className={`flex min-h-11 items-center gap-1.5 rounded border px-3 py-2 text-sm transition-colors ${
              selected.has(p.id)
                ? "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                : "border-white/20 hover:bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              name="playerIds"
              value={p.id}
              checked={selected.has(p.id)}
              onChange={() => toggle(p.id)}
              disabled={pending}
              className="h-4 w-4 shrink-0"
            />
            <span className="truncate">
              {p.name} ({p.points})
            </span>
          </label>
        ))}
      </div>
      {/* Lebt hier statt in der Server-Komponente page.tsx, weil das
          Aktivieren von der tatsächlichen Auswahl abhängt (mindestens 3
          angehakte Spieler) — nicht von der Grösse des ganzen
          Liga-Kaders, wie es vorher fälschlich der Fall war. */}
      <PrimaryButton
        type="submit"
        className="w-fit"
        disabled={selected.size < 3}
        loading={pending}
      >
        {pending ? "Starte…" : "Abend starten — Runde 1 berechnen"}
      </PrimaryButton>
    </div>
  );
}
