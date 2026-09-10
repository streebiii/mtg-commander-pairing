"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/Button";
import { finishEvening } from "./actions";

/** "Abend beenden" — mit Ladetext, Hover/Pressed via SecondaryButton. */
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
    <SecondaryButton onClick={submit} disabled={disabled} loading={isPending}>
      {isPending ? "Beende…" : "Abend beenden"}
    </SecondaryButton>
  );
}
