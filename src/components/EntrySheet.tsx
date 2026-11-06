"use client";

import type { AchievementCategory } from "@prisma/client";
import type { ReactNode } from "react";
import { formatPoints, isRepeatable, SCOPE_LABELS } from "@/lib/achievements";
import {
  type SheetAchievement,
  type SheetMark,
  computeTotals,
  isParticipation,
  isPerGame,
  markKey,
  maxCount,
} from "@/lib/entrySheet";
import { type SetMark, SaveStatus, useMarks } from "@/components/sheetParts";

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

/**
 * Das Blatt des Organisators (siehe SPEC.md Abschnitt 12.2), für
 * Korrekturen und abgetippte Papierzettel: jedes Achievement nur einmal,
 * daneben je gespieltes Match eine Spalte zum Anhaken, dazu alles, was
 * einmal pro Abend zählt (Deckbau). Oben die laufende Summe wie auf dem
 * Punkteblatt. Der Spieler hat auf dem Handy ein eigenes Blatt
 * (PlayerSheet), beide speichern über `useMarks`.
 */
export default function EntrySheet({
  sheet,
  locked,
  onSetMark,
}: {
  sheet: EntrySheetData;
  locked: boolean;
  onSetMark: SetMark;
}) {
  const { marks, set, error, isPending } = useMarks(sheet.marks, onSetMark);

  const totals = computeTotals(
    sheet.achievements,
    marks,
    sheet.gamesPlayed,
    sheet.lastEvening,
  );

  const perGame = sheet.achievements.filter((a) => isPerGame(a.scope));
  const perEvening = sheet.achievements.filter((a) => !isPerGame(a.scope));

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
      <SaveStatus error={error} isPending={isPending} />
    </div>
  );

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
