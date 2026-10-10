"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { submitMine } from "./actions";

/**
 * «Abgeben» mit Rückfrage direkt darunter — nicht über window.confirm, das
 * in eingebetteten Browser-Ansichten stumm `false` liefert (siehe PlayerRow).
 */
export default function SubmitEntryButton() {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <PrimaryButton className="w-full" onClick={() => setConfirming(true)}>
        Abgeben
      </PrimaryButton>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-white/20 p-4">
      <p className="text-sm">
        Danach kannst du nichts mehr ändern. Korrekturen macht dann der
        Organisator.
      </p>
      <div className="flex gap-2">
        <SecondaryButton
          className="flex-1"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Zurück
        </SecondaryButton>
        <PrimaryButton
          className="flex-1"
          loading={isPending}
          onClick={() => startTransition(() => submitMine())}
        >
          {isPending ? "Gebe ab…" : "Jetzt abgeben"}
        </PrimaryButton>
      </div>
    </div>
  );
}
