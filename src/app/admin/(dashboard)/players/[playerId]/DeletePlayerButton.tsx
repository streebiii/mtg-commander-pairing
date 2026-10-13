"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DangerButton, SecondaryButton } from "@/components/Button";
import { deletePlayer } from "../actions";

/**
 * «Spieler entfernen» mit Rückfrage, inline statt window.confirm (liefert
 * in eingebetteten Browser-Ansichten stumm `false`). Mit Historie wird
 * archiviert statt gelöscht (SPEC.md Abschnitt 6.2).
 */
export default function DeletePlayerButton({
  playerId,
  inRunningEvening,
}: {
  playerId: string;
  inRunningEvening: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (inRunningEvening) {
    return (
      <p className="text-base opacity-70">
        Sitzt in der laufenden Runde an einem Tisch — Entfernen erst danach.
      </p>
    );
  }

  if (!confirming) {
    return (
      <SecondaryButton className="w-fit" onClick={() => setConfirming(true)}>
        Spieler entfernen
      </SecondaryButton>
    );
  }

  function remove() {
    const fd = new FormData();
    fd.set("id", playerId);
    startTransition(async () => {
      await deletePlayer(fd);
      router.push("/admin/players");
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-3 rounded border border-white/20 p-4">
      <p className="text-base">
        Spieler entfernen? Hat er schon an Runden teilgenommen, wird er
        archiviert — seine Punkte bleiben in der Rangliste.
      </p>
      <div className="flex gap-2">
        <SecondaryButton onClick={() => setConfirming(false)} disabled={isPending}>
          Abbrechen
        </SecondaryButton>
        <DangerButton onClick={remove} loading={isPending}>
          {isPending ? "Entferne…" : "Entfernen"}
        </DangerButton>
      </div>
    </div>
  );
}
