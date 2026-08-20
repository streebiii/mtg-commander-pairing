"use client";

import { useTransition } from "react";
import { regenerateRound } from "./actions";

export default function RegenerateButton({ roundId, roundNumber }: { roundId: string; roundNumber: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (
          !window.confirm(
            `Runde ${roundNumber} wirklich neu auswürfeln? Die aktuelle Tischzuteilung geht dabei verloren.`,
          )
        ) {
          return;
        }
        const formData = new FormData();
        formData.set("roundId", roundId);
        // Direkter Aufruf der Server Action ohne umschließendes <form> —
        // vermeidet verschachtelte Formulare innerhalb der Ergebnis-Form.
        startTransition(() => {
          regenerateRound(formData);
        });
      }}
      className="min-h-11 w-fit rounded border border-black/20 px-4 py-2 text-sm dark:border-white/20 disabled:opacity-40"
    >
      {isPending ? "Würfle neu…" : "🎲 Neu mischen"}
    </button>
  );
}
