"use client";

import { useState, useTransition } from "react";
import { SecondaryButton } from "@/components/Button";
import { addLateArrival, removeLateArrival, undoDrop } from "./actions";

interface PlayerOption {
  id: string;
  name: string;
}

const ACTION =
  "inline-flex min-h-9 items-center rounded px-2 text-base underline-offset-2 hover:underline disabled:opacity-40";

/**
 * Anwesenheit während des Abends (siehe SPEC.md Abschnitt 5.3): Nachzügler
 * hinzufügen — auch wer sein Punkteblatt erst nach dem Auslosen gescannt
 * hat, steht hier und wartet aufs Einteilen —, Drops und Nachzügler
 * zurücknehmen. Gedroppt wird an der
 * Tischkachel (Spieler antippen → «Drop»). Sichtbar, bis Runde 2 live ist.
 */
export default function AttendancePanel({
  eveningId,
  dropped,
  lateArrivals,
  candidates,
  waiting,
}: {
  eveningId: string;
  dropped: PlayerOption[];
  lateArrivals: PlayerOption[];
  candidates: PlayerOption[];
  /** Haben ihr Blatt nach dem Auslosen gescannt und warten aufs Einteilen. */
  waiting: PlayerOption[];
}) {
  const [selected, setSelected] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
    });
  }

  function add() {
    if (!selected) return;
    const playerId = selected;
    setSelected("");
    run(() => addLateArrival(eveningId, playerId));
  }

  // Nichts zurückzunehmen und niemand mehr da, der dazukommen könnte —
  // dann keine leere Überschrift. Gedroppt wird ohnehin an der Tischkachel.
  if (
    dropped.length === 0 &&
    lateArrivals.length === 0 &&
    candidates.length === 0 &&
    waiting.length === 0
  ) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-medium">Anwesenheit</h3>

      {waiting.length > 0 && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/60 bg-amber-500/10 p-3">
          <p className="text-base">Gescannt, noch nicht eingeteilt:</p>
          <ul className="flex flex-col gap-1 text-base">
            {waiting.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="font-medium">{p.name}</span>
                <button
                  type="button"
                  className={ACTION}
                  disabled={isPending}
                  onClick={() => run(() => addLateArrival(eveningId, p.id))}
                >
                  Einteilen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(dropped.length > 0 || lateArrivals.length > 0) && (
        <ul className="flex flex-col gap-1 text-base">
          {dropped.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span>
                <span className="line-through opacity-60">{p.name}</span>{" "}
                <span className="text-base opacity-70">gedroppt</span>
              </span>
              <button
                type="button"
                className={ACTION}
                disabled={isPending}
                onClick={() => run(() => undoDrop(eveningId, p.id))}
              >
                Zurückholen
              </button>
            </li>
          ))}
          {lateArrivals.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span>
                {p.name} <span className="text-base opacity-70">Nachzügler, ab Match 2</span>
              </span>
              <button
                type="button"
                className={ACTION}
                disabled={isPending}
                onClick={() => run(() => removeLateArrival(eveningId, p.id))}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor="late-arrival">
            Nachzügler
          </label>
          <select
            id="late-arrival"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isPending}
            className="min-h-11 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-base"
          >
            <option value="">Nachzügler wählen…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <SecondaryButton className="w-full" onClick={add} disabled={!selected} loading={isPending}>
            {isPending ? "Trage ein…" : "Hinzufügen"}
          </SecondaryButton>
        </div>
      )}
    </section>
  );
}
