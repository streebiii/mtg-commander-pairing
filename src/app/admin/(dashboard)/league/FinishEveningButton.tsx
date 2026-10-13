"use client";

import { useState, useTransition } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/Button";
import { finishEvening } from "./actions";

/**
 * "Abend beenden" mit Rückfrage, inline statt window.confirm. Beenden lässt
 * sich nicht rückgängig machen: danach startet keine Runde mehr, und ein
 * neuer Abend würde die offene Achievement-Erfassung schliessen. Der Knopf
 * steht direkt neben "Nächste Runde starten" — ein Fehltipp nach Runde 1
 * hätte sonst den Abend gekostet.
 */
export default function FinishEveningButton({
  eveningId,
  roundsMissing,
}: {
  eveningId: string;
  /** Runden, die an diesem Abend noch nicht gespielt bzw. live sind. */
  roundsMissing: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <SecondaryButton className="w-full" onClick={() => setConfirming(true)}>
        Abend beenden
      </SecondaryButton>
    );
  }

  function submit() {
    const formData = new FormData();
    formData.set("eveningId", eveningId);
    startTransition(() => {
      finishEvening(formData);
    });
  }

  const ConfirmButton = roundsMissing > 0 ? DangerButton : PrimaryButton;

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded border border-white/20 p-4">
      {roundsMissing > 0 && (
        <p className="text-base font-medium text-red-300">
          Runde 2 wurde noch nicht gespielt.
        </p>
      )}
      <p className="text-base">
        Abend wirklich beenden? Danach lässt sich keine Runde mehr starten —
        das kann nicht rückgängig gemacht werden. Die Achievement-Erfassung
        bleibt offen.
      </p>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
          Abbrechen
        </SecondaryButton>
        <ConfirmButton loading={isPending} onClick={submit}>
          {isPending ? "Beende…" : "Jetzt beenden"}
        </ConfirmButton>
      </div>
    </div>
  );
}
