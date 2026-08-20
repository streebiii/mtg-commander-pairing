"use client";

import { useState, useTransition } from "react";
import { discardEvening } from "./actions";

/**
 * Verwirft einen versehentlich gestarteten Liga-Abend. Erscheint nur,
 * solange noch kein einziges Ergebnis erfasst wurde — danach hängen
 * bereits fortgeschriebene Liga-Punkte daran.
 *
 * Die Rückfrage läuft inline und nicht über window.confirm: in
 * eingebetteten Browser-Ansichten liefert window.confirm ohne Rückfrage
 * `false`, der Knopf wäre dort also wirkungslos.
 */
export default function DiscardEveningButton({ eveningId }: { eveningId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function discard() {
    const formData = new FormData();
    formData.set("eveningId", eveningId);
    startTransition(() => {
      discardEvening(formData);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded border border-red-600/40 px-4 py-2 text-sm text-red-600"
      >
        Abend verwerfen
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">
        Abend verwerfen? Die Zuteilung geht verloren, Spieler und Punktestände
        bleiben unverändert.
      </span>
      <button
        type="button"
        onClick={discard}
        disabled={isPending}
        className="min-h-11 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {isPending ? "Verwerfe…" : "Ja, verwerfen"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="min-h-11 rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
      >
        Abbrechen
      </button>
    </span>
  );
}
