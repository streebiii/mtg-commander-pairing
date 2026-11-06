"use client";

import { useState, useTransition } from "react";
import { formatPoints, isRepeatable, SCOPE_LABELS } from "@/lib/achievements";
import {
  type SheetAchievement,
  type SheetMark,
  isParticipation,
  markKey,
  marksToMap,
  maxCount,
} from "@/lib/entrySheet";

export type SetMark = (
  eveningAchievementId: string,
  game: number,
  count: number,
) => Promise<boolean>;

/**
 * Die Häkchen eines Blatts, gemeinsam für Spieler und Organisator. Jede
 * Änderung speichert sofort; die Anzeige schaltet ohne Warten um und nimmt
 * die Änderung zurück, falls der Server sie ablehnt (z.B. weil die
 * Erfassung inzwischen geschlossen wurde) oder die Verbindung weg ist.
 */
export function useMarks(serverMarks: SheetMark[], onSetMark: SetMark) {
  const [marks, setMarks] = useState(() => marksToMap(serverMarks));
  // Lädt die Seite neu (AutoRefresh, z.B. nach einem Sieger des
  // Organisators), gelten die frischen Einträge vom Server.
  const [loadedMarks, setLoadedMarks] = useState(serverMarks);
  if (loadedMarks !== serverMarks) {
    setLoadedMarks(serverMarks);
    setMarks(marksToMap(serverMarks));
  }
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(a: SheetAchievement, game: number, count: number) {
    const key = markKey(a.id, game);
    const previous = marks.get(key) ?? 0;
    const next = Math.max(0, Math.min(maxCount(a.scope), count));
    if (next === previous) return;

    setError(null);
    setMarks((prev) => {
      const m = new Map(prev);
      if (next === 0) m.delete(key);
      else m.set(key, next);
      return m;
    });
    startTransition(async () => {
      // Am Handy bricht die Verbindung auch mal ab. Ohne das try riss so ein
      // Fehler die ganze Seite mit, bis man sie neu lud.
      let problem: string | null = null;
      try {
        const ok = await onSetMark(a.id, game, next);
        if (!ok) {
          problem =
            "Konnte nicht gespeichert werden — vermutlich ist es schon bestätigt oder die Erfassung geschlossen. Lade die Seite neu.";
        }
      } catch {
        problem =
          "Nicht gespeichert: Verbindung prüfen und nochmals antippen. Hilft das nicht, lade die Seite neu.";
      }
      if (problem) {
        setMarks((prev) => {
          const m = new Map(prev);
          if (previous === 0) m.delete(key);
          else m.set(key, previous);
          return m;
        });
        setError(problem);
      }
    });
  }

  return { marks, set, error, isPending };
}

/** «Speichere…» bzw. der Fehler beim Speichern. */
export function SaveStatus({ error, isPending }: { error: string | null; isPending: boolean }) {
  return (
    <div className="text-base" aria-live="polite">
      {error ? (
        <span className="text-red-400">{error}</span>
      ) : isPending ? (
        <span className="opacity-50">Speichere…</span>
      ) : null}
    </div>
  );
}

/**
 * Ein Achievement als grosse Kachel zum Antippen (Blatt des Spielers):
 * Häkchen, bei mehrfach zählenden − n +. Alle gleich gestaltet, auch
 * Evergreen (Entscheid des Organisators vom 06.11.2026).
 */
export function AchievementTile({
  achievement: a,
  count: rawCount,
  disabled,
  note,
  onSet,
}: {
  achievement: SheetAchievement;
  count: number;
  disabled: boolean;
  /** Warum gesperrt, z.B. «Sieger: Anna S.» bei «Winner winner». */
  note?: string | null;
  onSet: (count: number) => void;
}) {
  const participation = isParticipation(a);
  const count = participation ? 1 : rawCount;
  const repeatable = isRepeatable(a.scope);
  const active = count > 0;
  const off = disabled || participation || Boolean(note);

  const label = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span>
        <span className="font-medium">{a.title}</span>{" "}
        <span className="opacity-60">{formatPoints(a.points)}</span>
        {repeatable && <span className="opacity-60"> · {SCOPE_LABELS[a.scope]}</span>}
        {participation && <span className="opacity-60"> · automatisch</span>}
        {note && <span className="opacity-60"> · {note}</span>}
      </span>
      {a.description && <span className="whitespace-pre-line opacity-60">{a.description}</span>}
    </span>
  );

  const tile = `flex min-h-11 items-center gap-3 rounded border px-3 py-2.5 text-base transition-colors ${
    active ? "border-blue-500 bg-blue-500/10" : "border-white/20"
  } ${off ? "" : active ? "hover:bg-blue-500/20" : "hover:bg-white/5"}`;

  if (repeatable && !participation) {
    return (
      <li className={tile}>
        {label}
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={off || count === 0}
            onClick={() => onSet(count - 1)}
            aria-label={`${a.title} weniger`}
            className="flex h-11 w-11 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30"
          >
            −
          </button>
          <span className="w-6 text-center font-medium tabular-nums" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            disabled={off || count >= maxCount(a.scope)}
            onClick={() => onSet(count + 1)}
            aria-label={`${a.title} mehr`}
            className="flex h-11 w-11 items-center justify-center rounded border border-white/20 text-lg disabled:opacity-30"
          >
            +
          </button>
        </span>
      </li>
    );
  }

  return (
    <li>
      <label className={`${tile} ${off ? "" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={active}
          disabled={off}
          onChange={(e) => onSet(e.target.checked ? 1 : 0)}
          className="h-5 w-5 shrink-0"
        />
        {label}
      </label>
    </li>
  );
}
