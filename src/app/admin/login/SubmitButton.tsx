"use client";

import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/Button";

/**
 * Absende-Button des Login-Formulars mit Ladezustand. Muss eine eigene
 * Client-Komponente innerhalb des <form> sein, weil useFormStatus den
 * Status des umgebenden Formulars liest. Das Deaktivieren während der
 * Prüfung verhindert nebenbei, dass ein Doppelklick zwei Versuche verbraucht
 * (max. 5 Fehlversuche pro 10 Minuten, SPEC.md Abschnitt 2).
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" loading={pending}>
      {pending ? "Prüfe Passwort…" : "Anmelden"}
    </PrimaryButton>
  );
}
