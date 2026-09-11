"use client";

import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/Button";

/**
 * Absende-Button für "Neuen Spieler anlegen" mit Ladezustand. Eigene
 * Client-Komponente innerhalb des <form>, weil useFormStatus den Status
 * des umgebenden Formulars liest (siehe admin/login/SubmitButton.tsx).
 */
export default function CreatePlayerButton() {
  const { pending } = useFormStatus();

  return (
    <PrimaryButton type="submit" className="w-full sm:w-auto" loading={pending}>
      {pending ? "Lege an…" : "Anlegen"}
    </PrimaryButton>
  );
}
