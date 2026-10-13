"use client";

import { useState, useTransition } from "react";
import { DangerButton, SecondaryButton } from "@/components/Button";
import { deleteTestRound } from "../actions";

/**
 * «Löschen» für eine Testrunde, mit Rückfrage inline (window.confirm
 * liefert in eingebetteten Browser-Ansichten stumm `false`).
 */
export default function DeleteTestRoundButton({ eveningId }: { eveningId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center rounded px-2 text-red-400 hover:bg-red-500/10"
      >
        Löschen
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span>Endgültig löschen?</span>
      <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
        Nein
      </SecondaryButton>
      <DangerButton
        loading={isPending}
        onClick={() => startTransition(() => deleteTestRound(eveningId))}
      >
        {isPending ? "Lösche…" : "Ja"}
      </DangerButton>
    </span>
  );
}
