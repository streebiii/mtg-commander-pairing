"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CODE_LENGTH } from "@/lib/loginToken";
import { submitLoginCode } from "./actions";

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="min-h-11 rounded bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
    >
      {pending ? "Prüfe Code…" : "Anmelden"}
    </button>
  );
}

/**
 * Eingabemaske für den sechsstelligen Login-Code.
 *
 * Bewusst ein einzelnes Feld statt sechs Einzelboxen: das automatische
 * Ausfüllen aus der Email (`autocomplete="one-time-code"`) funktioniert so
 * zuverlässig, und Einfügen aus der Zwischenablage ebenfalls. Nicht-Ziffern
 * werden direkt beim Tippen verworfen.
 */
export default function CodeForm({ next }: { next: string }) {
  const [code, setCode] = useState("");

  return (
    <form action={submitLoginCode} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2 text-sm">
        Code aus der Email
        <input
          name="code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          autoFocus
          aria-label={`${CODE_LENGTH}-stelliger Login-Code`}
          placeholder="••••••"
          className="min-h-14 w-full rounded border border-white/20 px-4 py-3 text-center font-mono text-3xl tracking-[0.4em]"
        />
      </label>
      <ConfirmButton disabled={code.length !== CODE_LENGTH} />
    </form>
  );
}
