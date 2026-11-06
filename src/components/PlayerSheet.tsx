"use client";

import { type ReactNode, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { AchievementTile, type SetMark, SaveStatus, useMarks } from "@/components/sheetParts";
import type { SheetData } from "@/lib/entries";
import {
  type SheetAchievement,
  computeBreakdown,
  computeTotals,
  isPerGame,
  markKey,
} from "@/lib/entrySheet";

/** Was der Spieler gerade tut: Übersicht, ein Schritt ausfüllen oder dessen Rückfrage. */
type View = { kind: "home" } | { kind: "edit"; step: number } | { kind: "confirm"; step: number };

/** Die Gruppen eines Spiels, wie auf dem Papierblatt. */
const GAME_GROUPS = [
  { category: "FIXED", label: "Core" },
  { category: "ROTATING", label: "Rotate" },
  { category: "DECKBUILDING", label: "Deckbau" },
] as const;

function stepName(step: number) {
  return step === 0 ? "Deckbau" : `Spiel ${step}`;
}

/**
 * Das Blatt des Spielers auf dem Handy (SPEC.md Abschnitt 12.2), in der
 * Reihenfolge des Abends:
 *
 * 1. **Deckbau** zuerst und als Pflicht: bis er bestätigt ist, gibt es
 *    nichts anderes einzutragen. Der Tisch steht trotzdem schon oben,
 *    sobald das Match live ist — niemand soll den Start aufhalten.
 * 2. **Übersicht**: Tisch, Bestätigtes mit Punkten und je Spiel, das live
 *    ist und an dem er sitzt, «Punkte eintragen».
 * 3. **Punkte eintragen**: die Achievements dieses Spiels abhaken, wie sie
 *    auf dem Papier stehen; jedes Häkchen speichert sofort.
 * 4. **Rückfrage**: kompakte Liste mit Punkten und «Du hast in Spiel 1
 *    x Punkte gemacht. Korrekt?». Mit «Ja» ist der Schritt für ihn
 *    gesperrt, nur noch der Organisator korrigiert.
 */
export default function PlayerSheet({
  sheet,
  title,
  subtitle,
  closed,
  waiting,
  matchAhead,
  tablemates,
  onSetMark,
  onConfirm,
}: {
  sheet: SheetData;
  title: string;
  subtitle: string;
  /** Die Erfassung ist geschlossen — nur noch ansehen. */
  closed: boolean;
  /** Warum (noch) kein Tisch dasteht, z.B. «Der Organisator teilt dich ein.». */
  waiting: string | null;
  /** Nach Spiel 1 kommt für ihn noch Match 2. */
  matchAhead: boolean;
  /** Die öffentlichen Namen der Mitspieler an seinem Tisch. */
  tablemates: string[];
  onSetMark: SetMark;
  onConfirm: (step: number) => Promise<boolean>;
}) {
  const { marks, set, error, isPending } = useMarks(sheet.marks, onSetMark);
  const [view, setView] = useState<View>({ kind: "home" });
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, startConfirm] = useTransition();

  const deckDone = sheet.confirmedGames.includes(0);
  const isDone = (step: number) => sheet.confirmedGames.includes(step);
  const isLocked = (step: number) => closed || isDone(step) || sheet.lockedGames.includes(step);

  const totals = computeTotals(sheet.achievements, marks, sheet.gamesPlayed, sheet.lastEvening);
  const breakdown = computeBreakdown(sheet.achievements, marks, sheet.gamesPlayed, sheet.lastEvening);
  const sectionOf = (step: number) =>
    breakdown.sections.find((s) => s.label === (step === 0 ? "Ganze Runde" : `Match ${step}`));
  const pointsOf = (step: number) => sectionOf(step)?.total ?? 0;

  // Evergreen zuoberst, damit es niemand übersieht.
  const perEvening = sheet.achievements
    .filter((a) => !isPerGame(a.scope))
    .sort((x, y) => Number(y.scope === "SEASON") - Number(x.scope === "SEASON"));
  const perGame = sheet.achievements.filter((a) => isPerGame(a.scope));

  // Ohne bestätigten Deckbau gibt es nur ihn — ausser die Erfassung ist zu.
  const current: View = !deckDone && !closed && view.kind === "home" ? { kind: "edit", step: 0 } : view;

  function goTo(next: View) {
    setConfirmError(null);
    setView(next);
    window.scrollTo({ top: 0 });
  }

  function confirm(step: number) {
    setConfirmError(null);
    startConfirm(async () => {
      let ok = false;
      try {
        ok = await onConfirm(step);
      } catch {
        ok = false;
      }
      if (ok) goTo({ kind: "home" });
      else
        setConfirmError(
          "Konnte nicht bestätigt werden. Prüfe die Verbindung und versuche es nochmals.",
        );
    });
  }

  function tiles(list: SheetAchievement[], step: number) {
    return (
      <ul className="flex flex-col gap-2">
        {list.map((a) => (
          <AchievementTile
            key={markKey(a.id, step)}
            achievement={a}
            count={marks.get(markKey(a.id, step)) ?? 0}
            disabled={isLocked(step)}
            onSet={(count) => set(a, step, count)}
          />
        ))}
      </ul>
    );
  }

  const seat = sheet.seat && !closed ? sheet.seat : null;
  const header = (
    <div className="sticky top-0 z-10 -mx-4 border-b border-white/10 bg-background px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-lg font-semibold">{title}</span>
        {seat && <span className="shrink-0 text-lg font-semibold">Tisch {seat.table}</span>}
      </div>
      <div className="flex items-baseline justify-between gap-3 text-base">
        <span className="min-w-0 truncate opacity-70">{subtitle}</span>
        <span className="shrink-0">
          Total <span className="font-semibold tabular-nums">{totals.total}</span>
        </span>
      </div>
      <SaveStatus error={error} isPending={isPending} />
    </div>
  );

  let content: ReactNode;
  if (current.kind === "edit") {
    const step = current.step;
    content = (
      <>
        {step === 0 && (
          <Notice>
            {seat
              ? "Du bist angemeldet, trage zuerst deine Deckbau-Achievements ein, danach kannst du deine Punkte eintragen."
              : "Du bist angemeldet, trage zuerst deine Deckbau-Achievements ein, danach siehst du hier deine Tischzuteilung."}
          </Notice>
        )}
        {step === 0 && seat && <SeatCard seat={seat} players={tablemates} />}
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">
            {step === 0 ? "Deckbau" : `Punkte eintragen · Spiel ${step}`}
          </h1>
          {step !== 0 && (
            <p className="text-base opacity-70">
              Hake ab, was du auf deinem Punkteblatt notiert hast. Participation zählt
              automatisch.
            </p>
          )}
        </div>
        {step === 0 ? (
          perEvening.length === 0 ? (
            <p className="text-base opacity-70">An diesem Abend gibt es keine Deckbau-Achievements.</p>
          ) : (
            tiles(perEvening, step)
          )
        ) : (
          // Gegliedert wie das Papierblatt, damit man Zeile für Zeile vergleichen kann.
          GAME_GROUPS.map((g) => {
            const list = perGame.filter((a) => a.category === g.category);
            return list.length === 0 ? null : (
              <section key={g.category} className="flex flex-col gap-2">
                <h2 className="text-lg font-medium">{g.label}</h2>
                {tiles(list, step)}
              </section>
            );
          })
        )}
        <div className="flex flex-col gap-2">
          <PrimaryButton className="w-full" onClick={() => goTo({ kind: "confirm", step })}>
            Weiter
          </PrimaryButton>
          {deckDone && (
            <SecondaryButton className="w-full" onClick={() => goTo({ kind: "home" })}>
              Zurück
            </SecondaryButton>
          )}
        </div>
      </>
    );
  } else if (current.kind === "confirm") {
    const step = current.step;
    const section = sectionOf(step);
    const points = pointsOf(step);
    content = (
      <>
        <h1 className="text-xl font-semibold">{stepName(step)} bestätigen</h1>
        <div className="flex flex-col gap-1 rounded border border-white/20 px-3 py-2">
          {section && section.items.length > 0 ? (
            <ul className="flex flex-col">
              {section.items.map((item) => (
                <li key={item.title} className="flex justify-between gap-3 text-base">
                  <span className="min-w-0">
                    {item.title}
                    {item.count > 1 && <span className="opacity-60"> ×{item.count}</span>}
                  </span>
                  <span className="tabular-nums">{item.points * item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base opacity-70">Nichts angehakt.</p>
          )}
          <div className="mt-1 flex justify-between gap-3 border-t border-white/10 pt-1 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{points}</span>
          </div>
        </div>
        <p className="text-lg font-medium">
          {step === 0
            ? `Du hast ${points} ${points === 1 ? "Deckbau-Punkt" : "Deckbau-Punkte"}. Korrekt?`
            : `Spiel ${step}: Du hast ${points} ${points === 1 ? "Punkt" : "Punkte"} gemacht. Korrekt?`}
        </p>
        <p className="text-base opacity-70">
          Danach kannst du {stepName(step)} nicht mehr ändern, nur noch der Organisator.
        </p>
        <div className="flex flex-col gap-2">
          <PrimaryButton
            className="w-full"
            loading={confirming}
            disabled={isPending}
            onClick={() => confirm(step)}
          >
            {confirming ? "Bestätige…" : "Ja, bestätigen"}
          </PrimaryButton>
          <SecondaryButton
            className="w-full"
            disabled={confirming}
            onClick={() => goTo({ kind: "edit", step })}
          >
            Zurück, ändern
          </SecondaryButton>
          {confirmError && <p className="text-base text-red-400">{confirmError}</p>}
        </div>
      </>
    );
  } else {
    // Spiele, die live sind und an denen er sitzt, noch nicht bestätigt.
    const open = sheet.gamesPlayed.filter((g) => !isLocked(g));
    const done = [0, ...sheet.gamesPlayed].filter((s) => isDone(s) || (s !== 0 && sheet.lockedGames.includes(s)));
    content = (
      <>
        {closed && (
          <p className="rounded border border-white/20 px-3 py-2 text-base">
            Die Erfassung für diesen Abend ist geschlossen.
          </p>
        )}
        {seat ? (
          <SeatCard seat={seat} players={tablemates} />
        ) : (
          !closed && waiting && <Notice>{waiting}</Notice>
        )}
        {open.map((g) => (
          <PrimaryButton key={g} className="w-full" onClick={() => goTo({ kind: "edit", step: g })}>
            Punkte eintragen · Spiel {g}
          </PrimaryButton>
        ))}
        {done.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Bestätigt</h2>
            <ul className="flex flex-col rounded border border-white/10">
              {done.map((s) => (
                <li
                  key={s}
                  className="flex justify-between gap-3 border-b border-white/5 px-3 py-2 text-base last:border-b-0"
                >
                  <span>
                    <span aria-hidden="true">✓ </span>
                    {stepName(s)}
                    {!isDone(s) && <span className="opacity-60"> · abgeschlossen</span>}
                  </span>
                  <span className="tabular-nums">{pointsOf(s)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!closed && open.length === 0 && !waiting && sheet.gamesPlayed.length > 0 && (
          <p className="rounded border border-green-600/40 bg-green-600/10 px-3 py-2 text-base">
            {matchAhead
              ? "Spiel 1 ist bestätigt. Sobald Match 2 live ist, steht hier dein neuer Tisch."
              : `Fertig. Du hast heute ${totals.total} ${totals.total === 1 ? "Punkt" : "Punkte"} gemacht.`}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {content}
    </div>
  );
}

/** «Match 1 · Tisch 3» und wer sonst noch an diesem Tisch sitzt. */
function SeatCard({
  seat,
  players,
  note,
}: {
  seat: { game: number; table: number };
  players: string[];
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-blue-500 bg-blue-500/10 px-4 py-4">
      <span className="text-2xl font-semibold tabular-nums">
        Match {seat.game} · Tisch {seat.table}
      </span>
      {players.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-lg">
          {players.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      {note && <span className="text-base opacity-80">{note}</span>}
    </div>
  );
}

/** Ein Hinweis an den Spieler, z.B. worauf er wartet — schlicht blau, ohne Kasten. */
function Notice({ children }: { children: ReactNode }) {
  return <p className="text-base text-blue-400">{children}</p>;
}
