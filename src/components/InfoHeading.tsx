"use client";

import { useState } from "react";

export interface InfoTopic {
  title: string;
  text: string;
}

/**
 * Seitenüberschrift mit aufklappbarer Erklärung — gemeinsam für Casual
 * und Liga, die beide ein Spiel starten und gleich aufgebaut sind.
 *
 * Kein Dauertext unter der Überschrift: im Alltag weiss der Organisator,
 * was der Modus tut, und der Platz auf dem Handy ist knapp. Bewusst ein
 * aufklappbarer Abschnitt statt `window.alert` — Letzteres liefert in
 * eingebetteten Browser-Ansichten gar keinen Dialog.
 */
export default function InfoHeading({
  title,
  subtitle,
  topics,
}: {
  title: string;
  subtitle?: string;
  topics: InfoTopic[];
}) {
  const [open, setOpen] = useState(false);
  const id = `info-${title.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? "Erklärung ausblenden" : `Erklärung zu «${title}» anzeigen`}
          className="flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-base font-semibold ${
              open ? "border-foreground" : "border-white/40 opacity-70"
            }`}
          >
            i
          </span>
        </button>
        {subtitle && <span className="text-base opacity-70">{subtitle}</span>}
      </div>

      {open && (
        <div id={id} className="flex flex-col gap-3 rounded border border-white/20 p-4">
          {topics.map((topic) => (
            <div key={topic.title} className="flex flex-col gap-0.5">
              <h2 className="text-lg font-medium">{topic.title}</h2>
              <p className="text-base opacity-70">{topic.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
