"use client";

import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/Button";

/**
 * Absende-Button des Login-Formulars mit Ladezustand. Muss eine eigene
 * Client-Komponente innerhalb des <form> sein, weil useFormStatus den
 * Status des umgebenden Formulars liest. Das Deaktivieren während des
 * Versands verhindert nebenbei, dass man sich per Doppelklick selbst ins
 * Rate-Limit befördert (max. 5 Anfragen pro 10 Minuten, SPEC.md Abschnitt 2).
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" loading={pending}>
      {pending ? "Code wird gesendet…" : "Login-Code anfordern"}
    </PrimaryButton>
  );
}
