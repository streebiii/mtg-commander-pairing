"use client";

import { useTransition } from "react";
import { PrimaryButton } from "@/components/Button";
import { startNextRound } from "./actions";

/** "Nächste Runde starten" — mit Ladetext, Hover/Pressed via PrimaryButton. */
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
    <PrimaryButton onClick={submit} disabled={disabled} loading={isPending}>
      {isPending ? "Starte…" : "Nächste Runde starten"}
    </PrimaryButton>
  );
}
