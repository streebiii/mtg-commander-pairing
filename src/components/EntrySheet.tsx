"use client";

import type { AchievementCategory } from "@prisma/client";
import { type ReactNode, useEffect, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { formatPoints, isRepeatable, SCOPE_LABELS } from "@/lib/achievements";
import {
  type SheetAchievement,
  type SheetMark,
  computeBreakdown,
  computeTotals,
  isParticipation,
  isPerGame,
  markKey,
  marksToMap,
  maxCount,
} from "@/lib/entrySheet";
import { MAX_ROUNDS } from "@/lib/pairing/leagueAssignment";

export interface EntrySheetData {
  achievements: SheetAchievement[];
  marks: SheetMark[];
  gamesPlayed: number[];
  /** Runden, die schon live sind — fehlt bei nachgetragenen Abenden. */
  liveRounds?: number[];
  lastEvening: boolean;
}

const GROUP_LABELS: Record<AchievementCategory, string> = {
  FIXED: "Fix",
  DECKBUILDING: "Deckbau",
  ROTATING: "Rotierend",
};

/** Die Schritte des Spieler-Blatts (SPEC.md Abschnitt 12.2). */
type Step = "deckbau" | number | "abgeben";
const GAMES = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1);
const STEPS: Step[] = ["deckbau", ...GAMES, "abgeben"];

function stepLabel(step: Step): string {
  if (step === "deckbau") return "Deckbau";
  if (step === "abgeben") return "Abgeben";
  return `Spiel ${step}`;
}

function parseStep(raw: string | null): Step | null {
  if (raw === "deckbau" || raw === "abgeben") return raw;
  const n = Number(raw);
  return GAMES.includes(n) ? n : null;
}

/**
 * Das Erfassungsblatt eines Spielers (siehe SPEC.md Abschnitt 12): je Spiel
 * die fixen und rotierenden Achievements, dazu alles, was einmal pro Abend
 * zählt (Deckbau). Oben die laufende Summe wie auf dem Punkteblatt.
 *
 * Mit `stepped` (das Blatt des Spielers auf dem Handy) geht es Schritt für
 * Schritt: zuerst Deckbau, dann Spiel 1, sobald Runde 1 live ist, dann
 * Spiel 2, sobald Runde 2 live ist, zum Schluss eine Übersicht mit
 * «Abgeben». Ohne `stepped` (Organisator, Papierzettel abtippen) steht
 * alles auf einer Seite.
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
  stepped = false,
  storageKey,
  submitSlot,
}: {
  sheet: EntrySheetData;
  locked: boolean;
  onSetMark: (
    eveningAchievementId: string,
    game: number,
    count: number,
  ) => Promise<boolean>;
  stepped?: boolean;
  /** Merkt sich den offenen Schritt pro Erfassung im Browser. */
  storageKey?: string;
  /** Der «Abgeben»-Knopf — erscheint im letzten Schritt. */
  submitSlot?: ReactNode;
}) {
  const [marks, setMarks] = useState(() => marksToMap(sheet.marks));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("deckbau");

  // Den zuletzt offenen Schritt wiederherstellen — erst nach dem Laden,
  // damit Server- und Browser-Darstellung übereinstimmen. Ohne Speicher
  // (privates Fenster) beginnt das Blatt einfach bei Deckbau.
  useEffect(() => {
    if (!stepped || !storageKey) return;
    try {
      const stored = parseStep(localStorage.getItem(`erfassung-schritt:${storageKey}`));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden
      if (stored !== null) setStep(stored);
    } catch {
      // Kein Zugriff auf den Speicher — dann eben ab Deckbau.
    }
  }, [stepped, storageKey]);

  function goTo(next: Step) {
    setStep(next);
    if (storageKey) {
      try {
        localStorage.setItem(`erfassung-schritt:${storageKey}`, String(next));
      } catch {
        // Nur eine Bequemlichkeit — ohne Speicher geht nichts verloren.
      }
    }
    window.scrollTo({ top: 0 });
  }

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
          <span className="whitespace-pre-line opacity-60">{a.description}</span>
        )}
      </span>
    );

    const tile = `flex min-h-11 items-center gap-3 rounded border px-3 py-2.5 text-base transition-colors ${
      active ? "border-blue-500 bg-blue-500/10" : "border-white/20"
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
    const present = categories
      .map((c) => ({ c, items: list.filter((a) => a.category === c) }))
      .filter((g) => g.items.length > 0);
    // Eine einzige Gruppe (z.B. nur Deckbau) braucht keinen Zwischentitel.
    return present.map((g) => (
        <div key={g.c} className="flex flex-col gap-2">
          {present.length > 1 && (
            <h3 className="text-base font-medium opacity-70">{GROUP_LABELS[g.c]}</h3>
          )}
          <ul className="flex flex-col gap-2">{g.items.map((a) => row(a, game))}</ul>
        </div>
      ));
  }

  const summary = (
    <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-background px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-base font-medium">
          Total <span className="text-xl font-semibold tabular-nums">{totals.total}</span>
        </span>
        <span className="text-base tabular-nums opacity-70">
          Core {totals.core} · Deckbau {totals.deckbau} · Rotate {totals.rotate}
        </span>
      </div>
      <div className="min-h-6 text-base" aria-live="polite">
        {error ? (
          <span className="text-red-400">{error}</span>
        ) : isPending ? (
          <span className="opacity-50">Speichere…</span>
        ) : null}
      </div>
    </div>
  );

  if (!stepped) {
    return (
      <div className="flex flex-col gap-6">
        {summary}

        {sheet.gamesPlayed.length === 0 && (
          <p className="text-base opacity-70">
            An diesem Abend noch an keinem Tisch.
          </p>
        )}

        {sheet.gamesPlayed.map((game) => (
          <section key={game} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Spiel {game}</h2>
            {groups(perGame, game)}
          </section>
        ))}

        {perEvening.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Ganzer Abend</h2>
            {groups(perEvening, 0)}
          </section>
        )}
      </div>
    );
  }

  const live = sheet.liveRounds ?? sheet.gamesPlayed;
  const stepIndex = STEPS.indexOf(step);
  const previous = STEPS[stepIndex - 1];
  const next = STEPS[stepIndex + 1];

  function gameState(game: number): "offen" | "nicht-gespielt" | "gesperrt" {
    if (sheet.gamesPlayed.includes(game)) return "offen";
    return live.includes(game) ? "nicht-gespielt" : "gesperrt";
  }

  let content: ReactNode;
  if (step === "deckbau") {
    content =
      perEvening.length > 0 ? (
        groups(perEvening, 0)
      ) : (
        <p className="text-base opacity-70">An diesem Abend gibt es keine Deckbau-Achievements.</p>
      );
  } else if (step === "abgeben") {
    const breakdown = computeBreakdown(
      sheet.achievements,
      marks,
      sheet.gamesPlayed,
      sheet.lastEvening,
    );
    const outstanding = GAMES.filter((g) => gameState(g) === "gesperrt");
    content = (
      <>
        {breakdown.sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <h3 className="flex justify-between text-base font-medium">
              <span>{section.label}</span>
              <span className="tabular-nums">{section.total}</span>
            </h3>
            <ul className="flex flex-col gap-1 text-base opacity-80">
              {section.items.map((item) => (
                <li key={item.title} className="flex justify-between gap-3">
                  <span>
                    {item.title}
                    {item.count > 1 && <span className="opacity-60"> ×{item.count}</span>}
                  </span>
                  <span className="tabular-nums">{item.points * item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {outstanding.length > 0 && !locked && (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-base">
            {outstanding.map((g) => `Spiel ${g}`).join(" und ")} steht noch aus. Gib
            erst ab, wenn du alles erfasst hast.
          </p>
        )}
        {submitSlot}
      </>
    );
  } else {
    const state = gameState(step);
    content =
      state === "offen" ? (
        groups(perGame, step)
      ) : state === "nicht-gespielt" ? (
        <p className="text-base opacity-70">Du hast Spiel {step} nicht gespielt.</p>
      ) : (
        <p className="text-base opacity-70">
          Spiel {step} lässt sich erfassen, sobald Runde {step} live ist.
        </p>
      );
  }

  return (
    <div className="flex flex-col gap-6">
      {summary}

      <nav aria-label="Schritte" className="grid grid-cols-4 gap-1">
        {STEPS.map((s) => {
          const current = s === step;
          const waiting = typeof s === "number" && gameState(s) === "gesperrt";
          return (
            <button
              key={String(s)}
              type="button"
              onClick={() => goTo(s)}
              aria-current={current ? "step" : undefined}
              className={`min-h-11 rounded border px-1 py-2 text-center text-base transition-colors ${
                current
                  ? "border-blue-500 bg-blue-500/10 font-medium"
                  : "border-white/20 hover:bg-white/5"
              } ${waiting && !current ? "opacity-50" : ""}`}
            >
              {stepLabel(s)}
            </button>
          );
        })}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{stepLabel(step)}</h2>
        {content}
      </section>

      <div className="flex justify-between gap-3">
        {previous !== undefined ? (
          <SecondaryButton onClick={() => goTo(previous)}>← {stepLabel(previous)}</SecondaryButton>
        ) : (
          <span />
        )}
        {next !== undefined && (
          <PrimaryButton onClick={() => goTo(next)}>{stepLabel(next)} →</PrimaryButton>
        )}
      </div>
    </div>
  );
}
