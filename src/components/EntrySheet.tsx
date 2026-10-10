"use client";

import type { AchievementCategory } from "@prisma/client";
import { useState, useTransition } from "react";
import { formatPoints, isRepeatable, SCOPE_LABELS } from "@/lib/achievements";
import {
  type SheetAchievement,
  type SheetMark,
  computeTotals,
  isParticipation,
  isPerGame,
  markKey,
  marksToMap,
  maxCount,
} from "@/lib/entrySheet";

export interface EntrySheetData {
  achievements: SheetAchievement[];
  marks: SheetMark[];
  gamesPlayed: number[];
  lastEvening: boolean;
}

const GROUP_LABELS: Record<AchievementCategory, string> = {
  FIXED: "Fix",
  DECKBUILDING: "Deckbau",
  ROTATING: "Rotierend",
};

/**
 * Das Erfassungsblatt eines Spielers (siehe SPEC.md Abschnitt 12): je Spiel
 * die fixen und rotierenden Achievements, darunter alles, was einmal pro
 * Abend zählt. Oben die laufende Summe wie auf dem Punkteblatt.
 *
 * Jede Änderung speichert sofort; die Anzeige schaltet ohne Warten um und
 * nimmt die Änderung zurück, falls der Server sie ablehnt (z.B. weil die
 * Erfassung inzwischen geschlossen wurde). Spieler und Organisator nutzen
 * dasselbe Blatt, nur mit unterschiedlicher Speicher-Aktion.
 */
export default function EntrySheet({
  sheet,
  locked,
  onSetMark,
}: {
  sheet: EntrySheetData;
  locked: boolean;
  onSetMark: (
    eveningAchievementId: string,
    game: number,
    count: number,
  ) => Promise<boolean>;
}) {
  const [marks, setMarks] = useState(() => marksToMap(sheet.marks));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = computeTotals(
    sheet.achievements,
    marks,
    sheet.gamesPlayed,
    sheet.lastEvening,
  );

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
      const ok = await onSetMark(a.id, game, next);
      if (!ok) {
        setMarks((prev) => {
          const m = new Map(prev);
          if (previous === 0) m.delete(key);
          else m.set(key, previous);
          return m;
        });
        setError(
          "Konnte nicht gespeichert werden — die Erfassung ist vermutlich geschlossen. Lade die Seite neu.",
        );
      }
    });
  }

  const perGame = sheet.achievements.filter((a) => isPerGame(a.scope));
  const perEvening = sheet.achievements.filter((a) => !isPerGame(a.scope));

  function row(a: SheetAchievement, game: number) {
    const participation = isParticipation(a);
    const count = participation ? 1 : (marks.get(markKey(a.id, game)) ?? 0);
    const repeatable = isRepeatable(a.scope);
    const active = count > 0;
    const disabled = locked || participation;

    const label = (
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>
          <span className="font-medium">{a.title}</span>{" "}
          <span className="opacity-60">{formatPoints(a.points)}</span>
          {repeatable && (
            <span className="opacity-60"> · {SCOPE_LABELS[a.scope]}</span>
          )}
          {participation && <span className="opacity-60"> · automatisch</span>}
        </span>
        {a.description && (
          <span className="whitespace-pre-line text-xs opacity-60">
            {a.description}
          </span>
        )}
      </span>
    );

    const tile = `flex min-h-11 items-center gap-3 rounded border px-3 py-2.5 text-sm transition-colors ${
      active
        ? "border-blue-500 bg-blue-500/10"
        : "border-white/20"
    } ${disabled ? "" : active ? "hover:bg-blue-500/20" : "hover:bg-white/5"}`;

    if (repeatable && !participation) {
      return (
        <li key={markKey(a.id, game)} className={tile}>
          {label}
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={disabled || count === 0}
              onClick={() => set(a, game, count - 1)}
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
              disabled={disabled || count >= maxCount(a.scope)}
              onClick={() => set(a, game, count + 1)}
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
      <li key={markKey(a.id, game)}>
        <label className={`${tile} ${disabled ? "" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            checked={active}
            disabled={disabled}
            onChange={(e) => set(a, game, e.target.checked ? 1 : 0)}
            className="h-5 w-5 shrink-0"
          />
          {label}
        </label>
      </li>
    );
  }

  function groups(list: SheetAchievement[], game: number) {
    const categories: AchievementCategory[] = ["FIXED", "ROTATING", "DECKBUILDING"];
    return categories
      .map((c) => ({ c, items: list.filter((a) => a.category === c) }))
      .filter((g) => g.items.length > 0)
      .map((g) => (
        <div key={g.c} className="flex flex-col gap-2">
          <h3 className="text-xs opacity-70">{GROUP_LABELS[g.c]}</h3>
          <ul className="flex flex-col gap-2">{g.items.map((a) => row(a, game))}</ul>
        </div>
      ));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Laufende Summe, beim Scrollen oben stehend */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-background px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">
            Total <span className="text-xl font-semibold tabular-nums">{totals.total}</span>
          </span>
          <span className="text-xs tabular-nums opacity-70">
            Core {totals.core} · Deckbau {totals.deckbau} · Rotate {totals.rotate}
          </span>
        </div>
        <div className="h-4 text-xs" aria-live="polite">
          {error ? (
            <span className="text-red-400">{error}</span>
          ) : isPending ? (
            <span className="opacity-50">Speichere…</span>
          ) : null}
        </div>
      </div>

      {sheet.gamesPlayed.length === 0 && (
        <p className="text-sm opacity-70">
          Du sitzt an diesem Abend noch an keinem Tisch.
        </p>
      )}

      {sheet.gamesPlayed.map((game) => (
        <section key={game} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Spiel {game}</h2>
          {groups(perGame, game)}
        </section>
      ))}

      {perEvening.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Ganzer Abend</h2>
          {groups(perEvening, 0)}
        </section>
      )}
    </div>
  );
}
