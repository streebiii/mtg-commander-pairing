"use client";

import { useTransition } from "react";
import { startNextRound } from "./actions";

/**
 * "Nächste Runde starten" — bisher ein einfacher `<button type="submit">`
 * ohne jeden Pending-Zustand. Jetzt mit Hover/Pressed/Loading, analog zu
 * RegenerateButton/DiscardEveningButton.
 */
export default function NextRoundButton({
  eveningId,
  disabled,
}: {
  eveningId: string;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("eveningId", eveningId);
    startTransition(() => {
      startNextRound(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={disabled || isPending}
      className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
    >
      {isPending ? "Starte…" : "Nächste Runde starten"}
    </button>
  );
}
