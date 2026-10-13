"use client";

import { useState, useTransition } from "react";
import { DangerButton, SecondaryButton } from "@/components/Button";
import { deleteRound } from "../actions";

/**
 * «Löschen» für eine Runde, mit Rückfrage inline (window.confirm liefert
 * in eingebetteten Browser-Ansichten stumm `false`). Die Rückfrage nennt,
 * was verloren geht — bei einer gezählten oder laufenden Runde deutlich.
 */
export default function DeleteRoundButton({
  eveningId,
  warning,
}: {
  eveningId: string;
  /** Was beim Löschen ausser der Runde selbst verloren geht, oder null. */
  warning: string | null;
}) {
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
    <span className="inline-flex max-w-md flex-wrap items-center justify-end gap-2 py-2 text-left">
      <span>
        Endgültig löschen?
        {warning && <span className="block text-red-300">{warning}</span>}
      </span>
      <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
        Nein
      </SecondaryButton>
      <DangerButton
        loading={isPending}
        onClick={() => startTransition(() => deleteRound(eveningId))}
      >
        {isPending ? "Lösche…" : "Ja"}
      </DangerButton>
    </span>
  );
}
