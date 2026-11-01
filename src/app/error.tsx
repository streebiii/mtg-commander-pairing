"use client";

import { PrimaryButton } from "@/components/Button";

/**
 * Fängt ab, was sonst die ganze Seite leer zurücklässt, etwa eine kurz
 * unterbrochene Verbindung oder eine neue Version, die inzwischen live ist.
 * Neu geladen wird die ganze Seite: ein Wiederholen allein hülfe nach einer
 * neuen Version nicht.
 */
export default function ErrorPage() {
  return (
    <div className="mx-auto flex w-full min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Da ist etwas schiefgelaufen</h1>
      <p className="text-base opacity-70">
        Vermutlich war die Verbindung kurz weg. Was schon gespeichert ist, bleibt
        erhalten.
      </p>
      <PrimaryButton className="w-full" onClick={() => window.location.reload()}>
        Neu laden
      </PrimaryButton>
    </div>
  );
}
