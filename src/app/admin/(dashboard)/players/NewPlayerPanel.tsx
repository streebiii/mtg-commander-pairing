"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { SKILL_LEVELS } from "@/lib/players";
import { createPlayer } from "./actions";

/** Eingabefelder bleiben bei 16px (iOS-Zoom, siehe globals.css). */
const INPUT = "min-h-11 w-full rounded border border-white/20 bg-transparent px-3 py-2";

/**
 * Seitenpanel zum Anlegen eines Spielers — wie «Neues Achievement»: es
 * speichert erst mit «Anlegen», nicht automatisch. Schliessen per Esc,
 * Klick auf den Hintergrund oder ×.
 */
export default function NewPlayerPanel({ onClose }: { onClose: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [skillLevel, setSkillLevel] = useState(0);
  const [leagueActive, setLeagueActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstInput = useRef<HTMLInputElement>(null);
  // Über eine Ref, damit der Effekt nur beim Öffnen läuft.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    firstInput.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    // Hintergrund nicht mitscrollen, solange das Panel offen ist.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("Bitte einen Vornamen eingeben.");
      firstInput.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await createPlayer({ firstName, lastName, skillLevel, leagueActive });
      if ("error" in result) setError(result.error);
      else onClose();
    });
  }

  const titleId = "new-player-title";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="relative flex h-full w-full flex-col border-l border-white/10 bg-surface shadow-2xl sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 id={titleId} className="text-lg font-medium">
            Neuer Spieler
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="flex min-h-11 min-w-11 items-center justify-center rounded text-xl hover:bg-white/10"
          >
            ×
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 text-base">
          <label className="flex flex-col gap-1.5">
            Vorname
            <input
              ref={firstInput}
              type="text"
              required
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-player-error" : undefined}
              className={INPUT}
            />
            {error && (
              <span id="new-player-error" role="alert" className="text-base text-red-400">
                {error}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            Nachname (optional)
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            Stufe (0-3)
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(Number(e.target.value))}
              className={`${INPUT} w-24 bg-surface`}
            >
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <span className="text-base opacity-60">
              Nur hier sichtbar — dient allein der ausgewogenen Zuteilung im
              Casual-Modus.
            </span>
          </label>

          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={leagueActive}
              onChange={(e) => setLeagueActive(e.target.checked)}
              className="h-5 w-5"
            />
            Nimmt an der Liga teil
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <SecondaryButton onClick={onClose} disabled={isPending}>
            Abbrechen
          </SecondaryButton>
          <PrimaryButton type="submit" loading={isPending}>
            {isPending ? "Lege an…" : "Anlegen"}
          </PrimaryButton>
        </footer>
      </form>
    </div>
  );
}
