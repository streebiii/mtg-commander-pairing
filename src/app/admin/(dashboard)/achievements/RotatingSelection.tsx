"use client";

import { useState, useTransition } from "react";
import { formatPoints } from "@/lib/achievements";
import { setEveningSelected, setNextSelected } from "./actions";

interface RotatingOption {
  id: string;
  title: string;
  description: string;
  points: number;
  repeatable: boolean;
}

/** Wohin ein Häkchen speichert: Vormerkung für den nächsten Abend oder ein laufender Abend. */
type Target = { kind: "next" } | { kind: "evening"; eveningId: string };

/**
 * Ankreuz-Liste der rotierenden Achievements. Jedes Häkchen speichert
 * sofort (Auto-Save, siehe SPEC.md Abschnitt 6.4). Bewusst ohne Zähler
 * oder Sperre auf 10: die Auswahl wird von mtgbl.ch übernommen, nicht hier
 * entschieden (siehe BACKLOG.md).
 *
 * Der Ankreuz-Zustand wird lokal geführt und sofort umgeschaltet, damit
 * schnelles Antippen mehrerer Kacheln nicht auf jede Server-Antwort warten
 * muss. Das Suchfeld filtert nur die Anzeige.
 */
export default function RotatingSelection({
  options,
  selectedIds,
  target,
}: {
  options: RotatingOption[];
  selectedIds: string[];
  target: Target;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedIds),
  );
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const isSelected = !selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });

    const fd = new FormData();
    fd.set("selected", String(isSelected));
    startTransition(async () => {
      if (target.kind === "next") {
        fd.set("id", id);
        await setNextSelected(fd);
      } else {
        fd.set("eveningId", target.eveningId);
        fd.set("achievementId", id);
        await setEveningSelected(fd);
      }
    });
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter(
        (o) =>
          o.title.toLowerCase().includes(needle) ||
          o.description.toLowerCase().includes(needle),
      )
    : options;
  const chosen = options.filter((o) => selected.has(o.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm">
        {chosen.length === 0 ? (
          <span className="opacity-70">Noch keine ausgewählt.</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {chosen.map((o) => (
              <li
                key={o.id}
                className="rounded border border-blue-500 bg-blue-500/10 px-2 py-1 text-xs"
              >
                {o.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Achievement suchen"
        aria-label="Rotierende Achievements durchsuchen"
        className="min-h-9 w-full max-w-sm rounded border border-white/20 px-3 py-2 text-sm"
      />
      <div className="grid max-w-4xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((o) => (
          <label
            key={o.id}
            className={`flex min-h-11 cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm transition-colors ${
              selected.has(o.id)
                ? "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                : "border-white/20 hover:bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => toggle(o.id)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span>
                {o.title}{" "}
                <span className="opacity-50">
                  {formatPoints(o.points, o.repeatable)}
                </span>
              </span>
              <span className="text-xs opacity-60">{o.description}</span>
            </span>
          </label>
        ))}
        {visible.length === 0 && (
          <p className="text-xs opacity-70">Kein Achievement gefunden.</p>
        )}
      </div>
    </div>
  );
}
