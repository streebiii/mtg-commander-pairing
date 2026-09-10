"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Drei Basis-Buttons für die ganze App: Primary (Haupt-Aktion), Secondary
 * (neutrale Aktion/Abbrechen), Danger (destruktive Aktion). Decken
 * durchgehend dieselben Zustände ab — default, hover, pressed (`:active`),
 * loading, disabled — damit kein Knopf mehr "vergessen" wird, wie zuletzt
 * bei "Alle auswählen" und "Abend starten" passiert.
 *
 * `loading` sperrt den Knopf zusätzlich (kein Doppel-Submit) und zeigt
 * einen kleinen Spinner vor dem Inhalt. Der Ladetext selbst bleibt Sache
 * der Aufrufstelle (z. B. "Starte…", "Lösche…") — kontextspezifisch statt
 * generisch, das war schon vorher das bewährte Muster.
 *
 * Mindestgrösse durchgehend 44px (`min-h-11`), wie überall in der App.
 */
interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function makeButton(variantClasses: string) {
  return function Variant({
    loading = false,
    disabled,
    className = "",
    children,
    type = "button",
    ...rest
  }: ButtonProps) {
    return (
      <button
        type={type}
        disabled={disabled || loading}
        className={`${BASE} ${variantClasses} ${className}`}
        {...rest}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  };
}

/** Haupt-Aktion einer Ansicht — solider Kontrast, z. B. "Abend starten". */
export const PrimaryButton = makeButton(
  "bg-foreground text-background hover:opacity-90 active:opacity-80",
);

/** Neutrale/Abbrechen-Aktion — dezenter Rahmen, z. B. "Alle auswählen". */
export const SecondaryButton = makeButton(
  "border border-white/20 hover:bg-white/5 active:bg-white/10",
);

/** Destruktive Aktion — durchgehend rot, egal ob Ausloeser oder finale Bestaetigung. */
export const DangerButton = makeButton(
  "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
);
