"use client";

import { useState, useTransition } from "react";
import { regenerateRound } from "./actions";

/**
 * Würfelt die Tischzuteilung einer Runde neu aus. Die Rückfrage läuft
 * bewusst inline und nicht über window.confirm: in eingebetteten
 * Browser-Ansichten (z.B. Vorschau-Panels) liefert window.confirm ohne
 * Rückfrage `false`, der Button wäre dort also wirkungslos.
 */
export default function RegenerateButton({
  roundId,
  roundNumber,
}: {
  roundId: string;
  roundNumber: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function regenerate() {
    const formData = new FormData();
    formData.set("roundId", roundId);
    // Direkter Aufruf der Server Action ohne umschliessendes <form> —
    // vermeidet verschachtelte Formulare innerhalb der Ergebnis-Form.
    startTransition(() => {
      regenerateRound(formData);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(true)}
        className="min-h-11 w-fit rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
      >
        {isPending ? "Würfle neu…" : "🎲 Neu mischen"}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">
        Runde {roundNumber} neu auswürfeln? Die aktuelle Tischzuteilung geht
        dabei verloren.
      </span>
      <button
        type="button"
        onClick={regenerate}
        disabled={isPending}
        className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
      >
        {isPending ? "Würfle neu…" : "Ja, neu mischen"}
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
