"use client";

import { useState, useTransition } from "react";
import { HighlightButton, SecondaryButton } from "@/components/Button";
import { publishRanking } from "../actions";

/**
 * Macht die zurückgehaltene Endrangliste öffentlich. Lässt sich nicht
 * zurücknehmen, darum mit Rückfrage, inline wie bei «Runde beenden».
 */
export default function PublishRankingButton({ eveningId }: { eveningId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <HighlightButton onClick={() => setConfirming(true)}>
        Endrangliste veröffentlichen
      </HighlightButton>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded border border-white/20 p-4">
      <p className="text-base">
        Die Endrangliste wird für alle sichtbar. Das lässt sich nicht
        zurücknehmen.
      </p>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
          Abbrechen
        </SecondaryButton>
        <HighlightButton
          loading={isPending}
          onClick={() => startTransition(() => publishRanking(eveningId))}
        >
          {isPending ? "Veröffentliche…" : "Jetzt veröffentlichen"}
        </HighlightButton>
      </div>
    </div>
  );
}
