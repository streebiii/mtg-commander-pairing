"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { EVENINGS_PER_SEASON } from "@/lib/season";
import { closeEntry } from "./actions";

const TEST_EVENING = "test";

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
  const [round, setRound] = useState(
    suggestedRound === null ? TEST_EVENING : String(suggestedRound),
  );
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
      const result = await closeEntry(
        eveningId,
        round === TEST_EVENING ? null : Number(round),
      );
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
      <label className="flex flex-col gap-1.5 text-base">
        Zählt in der Rangliste als
        <select
          value={round}
          onChange={(e) => setRound(e.target.value)}
          disabled={isPending}
          className="min-h-9 w-fit rounded border border-white/20 bg-transparent px-3 py-2"
        >
          {Array.from({ length: EVENINGS_PER_SEASON }, (_, i) => i + 1).map((r) => (
            <option key={r} value={r}>
              R{r}
            </option>
          ))}
          <option value={TEST_EVENING}>Testrunde — zählt nicht</option>
        </select>
      </label>
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
