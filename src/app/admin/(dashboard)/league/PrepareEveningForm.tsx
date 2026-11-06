"use client";

import { type ReactNode, useActionState } from "react";
import { PrimaryButton } from "@/components/Button";
import Sidebar from "@/components/Sidebar";
import { prepareEvening } from "./actions";

/**
 * «Abend vorbereiten» (SPEC.md Abschnitt 5 und 12.1): legt den Liga-Abend
 * an, damit sich die Punkteblätter mit ihren QR-Codes drucken lassen —
 * z.B. am Vortag. Das Datum bestimmt, als welche Runde er zählt und ob
 * Evergreen auf dem Blatt steht.
 */
export default function PrepareEveningForm({
  defaultDate,
  sidebarExtra,
}: {
  /** "YYYY-MM-DD": der nächste Termin der Saison, sonst heute. */
  defaultDate: string;
  sidebarExtra?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(prepareEvening, null);

  return (
    <div className="grid gap-8 lg:grid-cols-4">
      <form action={formAction} className="flex max-w-xl flex-col gap-4 lg:col-span-3">
        <h2 className="text-lg font-medium">Abend vorbereiten</h2>
        <p className="text-base opacity-70">
          Jede und jeder Liga-Teilnehmende bekommt ein Punkteblatt mit eigenem
          QR-Code, gültig nur für diesen Abend. Wer ihn im Laden scannt, ist
          anwesend. Die Achievements des Abends werden dabei festgelegt —
          prüfe vorher die rotierenden.
        </p>
        <label className="flex flex-col gap-1.5 text-base">
          Datum des Abends
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            required
            disabled={pending}
            className="min-h-11 w-full max-w-xs rounded border border-white/20 bg-transparent px-3 py-2"
          />
        </label>
        <PrimaryButton type="submit" className="self-start" loading={pending}>
          {pending ? "Bereite vor…" : "Abend vorbereiten"}
        </PrimaryButton>
        {state?.error && <p className="text-base text-red-400">{state.error}</p>}
      </form>
      {sidebarExtra && <Sidebar>{sidebarExtra}</Sidebar>}
    </div>
  );
}
