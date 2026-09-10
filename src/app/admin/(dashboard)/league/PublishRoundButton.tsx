"use client";

import { useTransition } from "react";
import { PrimaryButton } from "@/components/Button";
import { publishRound } from "./actions";

/**
 * Schaltet die im Warteraum geprüfte Runde live — ab jetzt sieht die
 * öffentliche Seite diese Zuteilung, und Sieger lassen sich erfassen.
 */
export default function PublishRoundButton({ roundId }: { roundId: string }) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("roundId", roundId);
    startTransition(() => {
      publishRound(formData);
    });
  }

  return (
    <PrimaryButton onClick={submit} loading={isPending}>
      {isPending ? "Schalte live…" : "Live schalten"}
    </PrimaryButton>
  );
}
