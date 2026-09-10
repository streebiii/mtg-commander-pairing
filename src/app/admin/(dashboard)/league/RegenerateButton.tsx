"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
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
      <SecondaryButton
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="w-fit"
      >
        🎲 Neu mischen
      </SecondaryButton>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">
        Runde {roundNumber} neu auswürfeln? Die aktuelle Tischzuteilung geht
        dabei verloren.
      </span>
      <PrimaryButton onClick={regenerate} loading={isPending}>
        {isPending ? "Würfle neu…" : "Ja, neu mischen"}
      </PrimaryButton>
      <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
        Abbrechen
      </SecondaryButton>
    </span>
  );
}
