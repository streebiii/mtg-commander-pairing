"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { closeEntry } from "./actions";

/** «Erfassung schliessen» mit Rückfrage, inline statt window.confirm. */
export default function CloseEntryButton({
  eveningId,
  openCount,
}: {
  eveningId: string;
  openCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <PrimaryButton className="w-fit" onClick={() => setConfirming(true)}>
        Erfassung schliessen
      </PrimaryButton>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded border border-white/20 p-4">
      <p className="text-sm">
        {openCount > 0
          ? `${openCount} Spieler haben noch nicht abgegeben. `
          : ""}
        Danach können die Spieler nichts mehr ändern, und der Abend zählt in
        der Rangliste.
      </p>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
          Abbrechen
        </SecondaryButton>
        <PrimaryButton
          loading={isPending}
          onClick={() => startTransition(() => closeEntry(eveningId))}
        >
          {isPending ? "Schliesse…" : "Jetzt schliessen"}
        </PrimaryButton>
      </div>
    </div>
  );
}
