"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/Button";
import { finishEvening } from "./actions";

/** "Abend beenden" — mit Ladetext, Hover/Pressed via SecondaryButton. */
export default function FinishEveningButton({ eveningId }: { eveningId: string }) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("eveningId", eveningId);
    startTransition(() => {
      finishEvening(formData);
    });
  }

  return (
    <SecondaryButton onClick={submit} loading={isPending}>
      {isPending ? "Beende…" : "Abend beenden"}
    </SecondaryButton>
  );
}
