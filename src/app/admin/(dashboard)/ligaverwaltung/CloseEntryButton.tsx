"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import SeasonRoundSelect, {
  initialSeasonRound,
  parseSeasonRound,
} from "@/components/SeasonRoundSelect";
import { closeEntry } from "./actions";

/**
 * «Erfassung schliessen» mit Rückfrage, inline statt window.confirm. Die
 * Rückfrage bestätigt zugleich, in welcher Spalte der Rangliste der Abend
 * zählt — aus dem Datum vorbelegt, für eine Testrunde «zählt nicht»
 * (siehe SPEC.md Abschnitt 12.3).
 */
export default function CloseEntryButton({
  eveningId,
  openCount,
  suggestedRound,
}: {
  eveningId: string;
  openCount: number;
  /** Aus dem Datum abgeleitete Spalte, null ausserhalb der Saison. */
  suggestedRound: number | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [round, setRound] = useState(initialSeasonRound(suggestedRound));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <PrimaryButton className="w-fit" onClick={() => setConfirming(true)}>
        Erfassung schliessen
      </PrimaryButton>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await closeEntry(eveningId, parseSeasonRound(round));
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded border border-white/20 p-4">
      <p className="text-base">
        {openCount > 0
          ? `${openCount} Spieler haben noch nicht abgegeben. `
          : ""}
        Danach können die Spieler nichts mehr ändern.
      </p>
      <SeasonRoundSelect value={round} onChange={setRound} disabled={isPending} />
      {error && <p className="text-base text-red-400">{error}</p>}
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
          Abbrechen
        </SecondaryButton>
        <PrimaryButton loading={isPending} onClick={submit}>
          {isPending ? "Schliesse…" : "Jetzt schliessen"}
        </PrimaryButton>
      </div>
    </div>
  );
}
