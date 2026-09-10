"use client";

import { useTransition } from "react";
import { finishEvening } from "./actions";

/**
 * "Abend beenden" — bisher ein einfacher `<button type="submit">` ohne
 * jeden Pending-Zustand. Jetzt mit Hover/Pressed/Loading, analog zu
 * RegenerateButton/DiscardEveningButton.
 */
export default function FinishEveningButton({
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
      finishEvening(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={disabled || isPending}
      className="min-h-11 rounded border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40"
    >
      {isPending ? "Beende…" : "Abend beenden"}
    </button>
  );
}
