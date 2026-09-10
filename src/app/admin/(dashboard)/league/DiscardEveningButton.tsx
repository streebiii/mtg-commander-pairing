"use client";

import { useState, useTransition } from "react";
import { DangerButton, SecondaryButton } from "@/components/Button";
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
      <DangerButton onClick={() => setConfirming(true)}>
        Abend verwerfen
      </DangerButton>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">
        Abend verwerfen? Die Zuteilung geht verloren, Spieler und Punktestände
        bleiben unverändert.
      </span>
      <DangerButton onClick={discard} loading={isPending}>
        {isPending ? "Verwerfe…" : "Ja, verwerfen"}
      </DangerButton>
      <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
        Abbrechen
      </SecondaryButton>
    </span>
  );
}
