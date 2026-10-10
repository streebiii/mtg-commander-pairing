"use client";

import type { AchievementCategory, AchievementScope } from "@prisma/client";
import { useEffect, useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_SCOPE,
  SCOPES,
  SCOPE_LABELS,
  isRepeatable,
} from "@/lib/achievements";
import { createAchievement } from "./actions";

/** Eingabefelder bleiben bei 16px (iOS-Zoom, siehe globals.css). */
const INPUT =
  "min-h-11 w-full rounded border border-white/20 bg-transparent px-3 py-2";

/**
 * Seitenpanel zum Anlegen eines Achievements. Anders als die Tabelle
 * speichert es nicht automatisch: ein halb ausgefülltes Formular soll
 * nicht schon im Katalog landen, deshalb braucht es den Klick auf
 * «Anlegen». Die Kategorie ist mit dem offenen Reiter vorbelegt und nur
 * hier wählbar (siehe SPEC.md Abschnitt 11.1).
 *
 * Schliessen per Esc, Klick auf den Hintergrund oder ×.
 */
export default function NewAchievementPanel({
  category: initialCategory,
  onClose,
}: {
  category: AchievementCategory;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("1");
  const [category, setCategory] = useState(initialCategory);
  const [scope, setScope] = useState<AchievementScope>(
    DEFAULT_SCOPE[initialCategory],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleInput = useRef<HTMLInputElement>(null);
  // Über eine Ref, damit der Effekt nur beim Öffnen läuft.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    titleInput.current?.focus();
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
    // Ein Titel nur aus Leerzeichen kommt am Browser-Pflichtfeld vorbei.
    if (!title.trim()) {
      setError("Bitte einen Titel eingeben.");
      titleInput.current?.focus();
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    fd.set("description", description);
    fd.set("points", points);
    fd.set("category", category);
    fd.set("scope", scope);
    startTransition(async () => {
      const id = await createAchievement(fd);
      if (id) onClose();
      else setError("Konnte nicht angelegt werden — Titel und Punkte prüfen.");
    });
  }

  const titleId = "new-achievement-title";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="relative flex h-full w-full flex-col border-l border-white/10 bg-surface shadow-2xl sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <h2 id={titleId} className="text-sm font-medium">
            Neues Achievement
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

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 text-sm">
          <label className="flex flex-col gap-1.5">
            Titel
            <input
              ref={titleInput}
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-achievement-error" : undefined}
              className={INPUT}
            />
            {error && (
              <span
                id="new-achievement-error"
                role="alert"
                className="text-xs text-red-400"
              >
                {error}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            Beschreibung
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              Punkte
              <input
                type="number"
                required
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className={`${INPUT} tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              Kategorie
              <select
                value={category}
                onChange={(e) => {
                  const next = e.target.value as AchievementCategory;
                  // Art mitziehen, solange sie noch der Vorbelegung entspricht.
                  if (scope === DEFAULT_SCOPE[category]) {
                    setScope(DEFAULT_SCOPE[next]);
                  }
                  setCategory(next);
                }}
                className={`${INPUT} bg-surface`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            Art
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as AchievementScope)}
              className={`${INPUT} bg-surface`}
            >
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
            <span className="text-xs opacity-60">
              {isRepeatable(scope)
                ? "Zählt mehrfach — bei der Erfassung gibt es ein Anzahl-Feld."
                : "Zählt einmal — bei der Erfassung gibt es ein Häkchen."}
            </span>
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
