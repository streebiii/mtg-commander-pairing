"use client";

import { useState, useTransition } from "react";
import { setAbsentEvergreen } from "../../actions";

/**
 * Evergreen für Liga-Teilnehmende, die am letzten Abend nicht gespielt
 * haben (SPEC.md Abschnitt 13.1): zählt in der Rangliste in der Spalte EG,
 * R6 bleibt leer.
 */
export default function AbsentEvergreen({
  eveningId,
  points,
  players,
}: {
  eveningId: string;
  points: number;
  players: { id: string; name: string; hasEvergreen: boolean }[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(playerId: string, on: boolean) {
    setPendingId(playerId);
    setError(null);
    startTransition(async () => {
      const ok = await setAbsentEvergreen(eveningId, playerId, on);
      if (!ok) setError("Konnte nicht gespeichert werden.");
      setPendingId(null);
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Evergreen ohne Teilnahme</h2>
      <p className="max-w-3xl text-base opacity-70">
        Für Liga-Teilnehmende, die am letzten Abend nicht gespielt haben. Evergreen (+{points}) zählt dann in der Rangliste in der Spalte EG, R6 bleibt leer.
      </p>
      {error && <p className="text-base text-red-400">{error}</p>}
      <ul className="flex w-full max-w-3xl flex-col rounded border border-white/10">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex min-h-11 items-center justify-between gap-3 border-b border-white/5 px-3 py-1 last:border-b-0"
          >
            <span className="min-w-0 truncate text-base font-medium">{p.name}</span>
            <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-base">
              <input
                type="checkbox"
                checked={p.hasEvergreen}
                disabled={pendingId !== null}
                onChange={(e) => toggle(p.id, e.target.checked)}
                className="h-5 w-5"
              />
              {pendingId === p.id ? "Speichere…" : "Evergreen"}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
