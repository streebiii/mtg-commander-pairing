"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { startNextRound } from "./actions";

/**
 * "Nächstes Match starten" — mit Ladetext, Hover/Pressed via PrimaryButton.
 *
 * Im Final-Ablauf (`pairByPoints`) nennt eine Rückfrage, wer Match 1 noch
 * nicht als fertig gemeldet hat; auslosen lässt es sich trotzdem (SPEC.md
 * Abschnitt 5.4).
 */
export default function NextRoundButton({
  eveningId,
  disabled,
  pairByPoints = false,
  missing = [],
}: {
  eveningId: string;
  disabled: boolean;
  pairByPoints?: boolean;
  /** Wer Match 1 noch nicht als fertig gemeldet hat. */
  missing?: string[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("eveningId", eveningId);
    startTransition(() => {
      startNextRound(formData);
    });
  }

  if (confirming && !disabled && missing.length > 0) {
    return (
      <div className="flex flex-col gap-2 text-base">
        <p>
          Noch nicht fertig: {missing.join(", ")}. Es zählt, was bis jetzt
          eingetragen ist.
        </p>
        <PrimaryButton className="w-full" onClick={submit} loading={isPending}>
          {isPending ? "Lose aus…" : "Trotzdem auslosen"}
        </PrimaryButton>
        <SecondaryButton
          className="w-full"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Warten
        </SecondaryButton>
      </div>
    );
  }

  const label = pairByPoints ? "Match 2 aus Punkten auslosen" : "Nächstes Match starten";
  return (
    <PrimaryButton
      className="w-full"
      onClick={missing.length > 0 ? () => setConfirming(true) : submit}
      disabled={disabled}
      loading={isPending}
    >
      {isPending ? "Starte…" : label}
    </PrimaryButton>
  );
}
