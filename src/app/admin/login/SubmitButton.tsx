"use client";

import { useFormStatus } from "react-dom";

/**
 * Absende-Button des Login-Formulars mit Ladezustand. Muss eine eigene
 * Client-Komponente innerhalb des <form> sein, weil useFormStatus den
 * Status des umgebenden Formulars liest. Das Deaktivieren während des
 * Versands verhindert nebenbei, dass man sich per Doppelklick selbst ins
 * Rate-Limit befördert (max. 3 Anfragen pro 15 Minuten, SPEC.md Abschnitt 2).
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
    >
      {pending ? "Login-Link wird gesendet…" : "Login-Link anfordern"}
    </button>
  );
}
