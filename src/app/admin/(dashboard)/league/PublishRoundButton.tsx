"use client";

import { useTransition } from "react";
import { HighlightButton } from "@/components/Button";
import { publishRound } from "./actions";

/**
 * Schaltet die im Warteraum geprüfte Runde live — ab jetzt sieht die
 * öffentliche Seite diese Zuteilung, und Sieger lassen sich erfassen.
 */
export default function PublishRoundButton({
  roundId,
  className,
}: {
  roundId: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function submit() {
    const formData = new FormData();
    formData.set("roundId", roundId);
    startTransition(() => {
      publishRound(formData);
    });
  }

  return (
    <HighlightButton className={className} onClick={submit} loading={isPending}>
      {isPending ? "Schalte live…" : "Live schalten"}
    </HighlightButton>
  );
}
