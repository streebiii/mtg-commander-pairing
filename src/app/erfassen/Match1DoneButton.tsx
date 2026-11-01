"use client";

import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/Button";
import { markGame1Done } from "./actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" className="w-full" loading={pending}>
      {pending ? "Melde…" : "Match 1 fertig"}
    </PrimaryButton>
  );
}

/**
 * Sagt dem Organisator, dass die Punkte von Match 1 eingetragen sind
 * (Final-Ablauf, SPEC.md Abschnitt 5.4). Ändern lässt sich bis zur
 * Auslosung von Match 2 weiterhin.
 */
export default function Match1DoneButton({ done }: { done: boolean }) {
  if (done) {
    return (
      <p className="rounded border border-green-600/40 bg-green-600/10 px-3 py-2 text-base">
        Gemeldet. Bis Match 2 ausgelost ist, kannst du noch ändern.
      </p>
    );
  }
  return (
    <form action={markGame1Done}>
      <Button />
    </form>
  );
}
