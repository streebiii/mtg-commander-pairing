"use client";

import { useTransition } from "react";
import { SecondaryButton } from "@/components/Button";
import { unpublishRound } from "./actions";

/**
 * Nimmt das live geschaltete Match zurück in den Warteraum (SPEC.md
 * Abschnitt 5.3), z.B. um noch Spieler hinzuzufügen. Steht an einem Tisch
 * schon ein Ergebnis, ist der Knopf gesperrt; warum, steht beim Darüberfahren.
 */
export default function UnpublishRoundButton({
  roundId,
  blocked,
}: {
  roundId: string;
  /** An einem Tisch steht schon ein Sieger oder Unentschieden. */
  blocked: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const hint = blocked
    ? "Geht nur, solange an keinem Tisch ein Ergebnis steht. Entferne zuerst Sieger und Unentschieden."
    : "Die Spieler sehen ihren Tisch erst wieder, wenn du das Match neu live schaltest.";

  return (
    // Der Hinweis hängt am Rahmen: ein gesperrter Knopf zeigt in manchen
    // Browsern selbst keinen Tooltip.
    <span title={hint} className="inline-flex">
      <SecondaryButton
        onClick={() => startTransition(() => unpublishRound(roundId))}
        disabled={blocked}
        loading={isPending}
      >
        {isPending ? "Nehme zurück…" : "Zurück in den Warteraum"}
      </SecondaryButton>
    </span>
  );
}
