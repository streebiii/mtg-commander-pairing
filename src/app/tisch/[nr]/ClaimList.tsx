"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { claimPlayer } from "./actions";

export interface ClaimOption {
  playerId: string;
  name: string;
  /** Auf einem anderen Handy angemeldet. */
  taken: boolean;
  /** Auf diesem Handy angemeldet. */
  mine: boolean;
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" className="w-full" loading={pending}>
      {pending ? "Melde an…" : "Ja"}
    </PrimaryButton>
  );
}

/**
 * Namen am Tisch zum Anmelden (SPEC.md Abschnitt 12.1). Ein Tipp fragt
 * erst nach, ob man das wirklich ist: die Anmeldung sperrt den Namen für
 * alle anderen Handys und dieses Handy für alle anderen Namen — ein
 * Fehltipp liess sich bisher nur über den Organisator lösen. Der eigene,
 * schon angemeldete Name führt ohne Rückfrage weiter.
 */
export default function ClaimList({
  tableNumber,
  options,
}: {
  tableNumber: number;
  options: ClaimOption[];
}) {
  const [chosen, setChosen] = useState<ClaimOption | null>(null);

  if (chosen) {
    return (
      <form
        action={claimPlayer.bind(null, tableNumber, chosen.playerId)}
        className="flex flex-col gap-3 rounded border border-white/20 p-4"
      >
        <p className="text-lg font-medium">Du bist {chosen.name}?</p>
        <p className="text-base opacity-70">
          Danach ist der Name auf diesem Handy angemeldet und für alle anderen
          gesperrt.
        </p>
        <ConfirmButton />
        <SecondaryButton className="w-full" onClick={() => setChosen(null)}>
          Zurück
        </SecondaryButton>
      </form>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {options.map((o) => {
        const className =
          "flex min-h-14 w-full items-center justify-between gap-3 rounded border border-white/20 px-4 py-3 text-left text-base transition-colors hover:bg-white/5 active:bg-white/10 disabled:opacity-40";
        const label = (
          <>
            <span className="font-medium">{o.name}</span>
            <span className="text-base opacity-70">
              {o.mine ? "du" : o.taken ? "angemeldet" : ""}
            </span>
          </>
        );
        return (
          <li key={o.playerId}>
            {o.mine ? (
              <form action={claimPlayer.bind(null, tableNumber, o.playerId)}>
                <button type="submit" className={className}>
                  {label}
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={o.taken}
                onClick={() => setChosen(o)}
                className={className}
              >
                {label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
