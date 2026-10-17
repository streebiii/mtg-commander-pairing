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
  isWinnerAchievement,
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
  /** Die Runde ist beendet — ein nicht gestartetes Match kommt nicht mehr. */
  finished?: boolean;
}

const GROUP_LABELS: Record<AchievementCategory, string> = {
  FIXED: "Fix",
  DECKBUILDING: "Deckbau",
  ROTATING: "Rotierend",
};

/** Fix, Rotierend, Deckbau — in dieser Reihenfolge, leere weggelassen. */
function categoryGroups(list: SheetAchievement[]) {
  const order: AchievementCategory[] = ["FIXED", "ROTATING", "DECKBUILDING"];
  return order
    .map((category) => ({ category, items: list.filter((a) => a.category === category) }))
    .filter((g) => g.items.length > 0);
}

/** Breite einer Match-Spalte — Kopf und Häkchen teilen sie, damit alles fluchtet. */
const MATRIX_COL = "w-12 shrink-0 sm:w-24";

/**
 * Liste des Organisator-Blatts: jedes Achievement einmal, mit Titel,
 * Punkten und der vollen Beschreibung, rechts je Match (bzw. «Runde») eine
 * Spalte zum Anhaken. Bewusst keine starre Tabelle: die Beschreibung soll
 * lesbar umbrechen statt gekürzt zu werden.
 *
 * Auf dem Handy sind die Spalten schmal (nur Häkchen, Kopf «M1»). Ein
 * − n + passt dort nicht hinein — mehrfach zählende Achievements bekommen
 * es deshalb in einer eigenen Zeile unter dem Text, mit «M1»/«M2» davor.
 */
function MatrixList({
  heading,
  columns,
  groups,
  cell,
  className = "",
}: {
  heading: string;
  className?: string;
  /** `short` steht auf dem Handy im Spaltenkopf («M1»). */
  columns: { key: number; label: string; short: string }[];
  groups: { category: AchievementCategory; items: SheetAchievement[] }[];
  cell: (a: SheetAchievement, game: number) => ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <h2 className="text-lg font-medium">{heading}</h2>
      <div className="rounded border border-white/10">
        <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2 font-medium text-foreground/70">
          <span className="min-w-0 flex-1">Achievement</span>
          <span className="flex">
            {columns.map((c) => (
              <span key={c.key} className={`${MATRIX_COL} text-center`}>
                <span className="sm:hidden">{c.short}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </span>
            ))}
          </span>
        </div>
        {groups.map((g) => (
          <div key={g.category}>
            {groups.length > 1 && (
              <h3 className="border-b border-white/5 bg-white/5 px-3 py-1.5 font-medium">
                {GROUP_LABELS[g.category]}
              </h3>
            )}
            <ul>
              {g.items.map((a) => {
                const stepper = isRepeatable(a.scope) && !isParticipation(a);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/5 px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1 basis-40">
                      <span className="font-medium">{a.title}</span>{" "}
                      <span className="opacity-60">{formatPoints(a.points)}</span>
                      {stepper && <span className="opacity-60"> · {SCOPE_LABELS[a.scope]}</span>}
                      {isParticipation(a) && <span className="opacity-60"> · automatisch</span>}
                      {a.description && (
                        <p className="whitespace-pre-line opacity-70">{a.description}</p>
                      )}
                    </div>
                    {/* Mit − n + auf dem Handy volle Breite unter dem Text,
                        ab sm in den Spalten wie die Häkchen. */}
                    <div
                      className={`flex ${
                        stepper ? "w-full justify-end gap-4 sm:w-auto sm:gap-0" : ""
                      }`}
                    >
                      {columns.map((c) => (
                        <div
                          key={c.key}
                          className={`flex items-center justify-center ${
                            stepper ? "gap-1 sm:w-24" : MATRIX_COL
                          }`}
                        >
                          {stepper && <span className="opacity-60 sm:hidden">{c.short}</span>}
                          {cell(a, c.key)}
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Die Schritte des Spieler-Blatts (SPEC.md Abschnitt 12.2). */
type Step = "deckbau" | number | "abgeben";
const GAMES = Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1);
const STEPS: Step[] = ["deckbau", ...GAMES, "abgeben"];

function stepLabel(step: Step): string {
  if (step === "deckbau") return "Deckbau";
  if (step === "abgeben") return "Abgeben";
  return `Match ${step}`;
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
 * alles auf einer Seite, als Liste mit einer Spalte pro Match
 * (MatrixList).
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
  winnerNotes,
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
  /**
   * Nur auf dem Blatt des Spielers: warum «Winner winner» je Match gesperrt
   * ist (z.B. «Sieger: Anna S.»), null, wenn er es selbst setzen darf. Es
   * folgt dem Tisch-Ergebnis (lib/winner.ts).
   */
  winnerNotes?: Record<number, string | null>;
}) {
  const [marks, setMarks] = useState(() => marksToMap(sheet.marks));
  // Lädt die Seite neu (AutoRefresh, z.B. nach einem Sieger des
  // Organisators), gelten die frischen Einträge vom Server.
  const [loadedMarks, setLoadedMarks] = useState(sheet.marks);
  if (loadedMarks !== sheet.marks) {
    setLoadedMarks(sheet.marks);
    setMarks(marksToMap(sheet.marks));
  }
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
    const winnerNote = isWinnerAchievement(a) ? (winnerNotes?.[game] ?? null) : null;
    const disabled = locked || participation || winnerNote !== null;

    const label = (
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>
          <span className="font-medium">{a.title}</span>{" "}
          <span className="opacity-60">{formatPoints(a.points)}</span>
          {repeatable && (
            <span className="opacity-60"> · {SCOPE_LABELS[a.scope]}</span>
          )}
          {participation && <span className="opacity-60"> · automatisch</span>}
          {winnerNote && <span className="opacity-60"> · {winnerNote}</span>}
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

  /** Steuerelement einer Zelle der Organisator-Tabelle: Häkchen bzw. − n +. */
  function matrixCell(a: SheetAchievement, game: number) {
    const participation = isParticipation(a);
    const count = participation ? 1 : (marks.get(markKey(a.id, game)) ?? 0);
    const label = game === 0 ? a.title : `${a.title}, Match ${game}`;
    if (isRepeatable(a.scope) && !participation) {
      return (
        <span className="inline-flex items-center">
          <button
            type="button"
            disabled={locked || count === 0}
            onClick={() => set(a, game, count - 1)}
            aria-label={`${label} weniger`}
            className="flex h-11 w-7 items-center justify-center rounded text-lg hover:bg-white/10 disabled:opacity-30 sm:w-9"
          >
            −
          </button>
          <span className="w-5 text-center font-medium tabular-nums" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            disabled={locked || count >= maxCount(a.scope)}
            onClick={() => set(a, game, count + 1)}
            aria-label={`${label} mehr`}
            className="flex h-11 w-7 items-center justify-center rounded text-lg hover:bg-white/10 disabled:opacity-30 sm:w-9"
          >
            +
          </button>
        </span>
      );
    }
    return (
      <label
        className={`inline-flex h-11 w-11 items-center justify-center rounded ${
          locked || participation ? "" : "cursor-pointer hover:bg-white/10"
        }`}
      >
        <input
          type="checkbox"
          checked={count > 0}
          disabled={locked || participation}
          onChange={(e) => set(a, game, e.target.checked ? 1 : 0)}
          aria-label={label}
          className="h-5 w-5"
        />
      </label>
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
    // Organisator: jedes Achievement nur einmal, daneben je Match eine
    // Spalte zum Anhaken — wie das Punkteblatt, aber ohne die Liste pro
    // Match zu wiederholen. Was für die ganze Runde zählt (Deckbau usw.),
    // steht ab lg rechts daneben mit einer Spalte «Runde», schmaler
    // darunter.
    return (
      <div className="flex flex-col gap-6">
        {summary}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {sheet.gamesPlayed.length === 0 ? (
            <p className="text-base opacity-70">In dieser Runde noch an keinem Tisch.</p>
          ) : (
            <MatrixList
              heading="Pro Match"
              columns={sheet.gamesPlayed.map((game) => ({
                key: game,
                label: `Match ${game}`,
                short: `M${game}`,
              }))}
              groups={categoryGroups(perGame)}
              cell={matrixCell}
            />
          )}

          {perEvening.length > 0 && (
            <MatrixList
              heading="Ganze Runde"
              // Neben der langen Liste «Pro Match» bleibt sie beim Scrollen
              // stehen, unter der Summenleiste — sonst klafft rechts eine
              // leere Fläche. Nur auf Bildschirmen, die hoch genug sind,
              // sonst wäre ihr Ende abgeschnitten.
              className="[@media(min-width:64rem)_and_(min-height:56rem)]:sticky [@media(min-width:64rem)_and_(min-height:56rem)]:top-24"
              columns={[{ key: 0, label: "Runde", short: "Runde" }]}
              groups={categoryGroups(perEvening)}
              cell={matrixCell}
            />
          )}
        </div>
      </div>
    );
  }

  const live = sheet.liveRounds ?? sheet.gamesPlayed;
  const stepIndex = STEPS.indexOf(step);
  const previous = STEPS[stepIndex - 1];
  const next = STEPS[stepIndex + 1];

  function gameState(game: number): "offen" | "nicht-gespielt" | "ausgefallen" | "gesperrt" {
    if (sheet.gamesPlayed.includes(game)) return "offen";
    if (live.includes(game)) return "nicht-gespielt";
    // Runde nach Match 1 beendet: Match 2 kommt nicht mehr, also steht es
    // auch nicht mehr aus.
    return sheet.finished ? "ausgefallen" : "gesperrt";
  }

  let content: ReactNode;
  if (step === "deckbau") {
    content =
      perEvening.length > 0 ? (
        groups(perEvening, 0)
      ) : (
        <p className="text-base opacity-70">In dieser Runde gibt es keine Deckbau-Achievements.</p>
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
            {outstanding.map((g) => `Match ${g}`).join(" und ")} steht noch aus. Gib
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
        <p className="text-base opacity-70">Du hast Match {step} nicht gespielt.</p>
      ) : state === "ausgefallen" ? (
        <p className="text-base opacity-70">Match {step} wurde in dieser Runde nicht gespielt.</p>
      ) : (
        <p className="text-base opacity-70">
          Match {step} lässt sich erfassen, sobald es live ist.
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
