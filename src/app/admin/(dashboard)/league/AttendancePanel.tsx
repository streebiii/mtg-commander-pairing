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
 * hinzufügen, Drops und Nachzügler zurücknehmen. Gedroppt wird an der
 * Tischkachel (Spieler antippen → «Drop»). Sichtbar, bis Runde 2 live ist.
 */
export default function AttendancePanel({
  eveningId,
  phase,
  dropped,
  lateArrivals,
  candidates,
}: {
  eveningId: string;
  /** Wohin eine Änderung wirkt: in den Warteraum von Runde 1, in Runde 2 (noch nicht berechnet) oder in den Warteraum von Runde 2. */
  phase: "round1Draft" | "round1Live" | "round2Draft";
  dropped: PlayerOption[];
  lateArrivals: PlayerOption[];
  candidates: PlayerOption[];
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

  const hint = {
    round1Draft:
      "Wer noch dazukommt, wird direkt in Runde 1 eingeteilt. Wer doch nicht spielt: an der Tischkachel antippen und «Drop». Runde 1 wird dabei jeweils neu gemischt.",
    round1Live:
      "Wer geht: an der Tischkachel antippen und «Drop» — er spielt Runde 1 zu Ende und wird in Runde 2 nicht eingeteilt. Nachzügler spielen ab Runde 2 mit.",
    round2Draft:
      "Wer geht oder dazukommt, ändert Runde 2 — sie wird dabei neu gemischt.",
  }[phase];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-medium">Anwesenheit</h3>
      <p className="text-base opacity-70">{hint}</p>

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
                {p.name} <span className="text-base opacity-70">Nachzügler, ab Runde 2</span>
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
