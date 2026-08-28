"use client";

import { useState } from "react";

/**
 * Überschrift des Casual-Tabs mit aufklappbarer Erklärung.
 *
 * Der frühere Dauertext unter der Überschrift ist bewusst weg — im Alltag
 * weiss der Organisator, was der Modus tut, und der Platz auf dem Handy
 * ist knapp. Wer die Erklärung braucht, holt sie sich über den Info-Knopf.
 *
 * Bewusst ein aufklappbarer Abschnitt statt `window.alert`: Letzteres
 * liefert in eingebetteten Browser-Ansichten gar keinen Dialog (siehe
 * Bugfix beim Löschen von Spielern).
 */
const TOPICS: { title: string; text: string }[] = [
  {
    title: "Spieler auswählen",
    text: "Antippen markiert einen Spieler als anwesend. Das Suchfeld filtert die Liste, ohne dass Einträge ihre Position wechseln. Wer noch nicht erfasst ist, wird direkt unter dem Suchfeld angelegt — der getippte Name ist dabei schon vorbefüllt.",
  },
  {
    title: "Gruppe bilden",
    text: "Spieler, die zusammen an einen Tisch sollen, lassen sich zu einer Gruppe zusammenfassen (2 bis 4 Spieler). Im Gruppen-Modus nimmt ein Tap den Spieler in die entstehende Gruppe auf und markiert ihn gleichzeitig als anwesend.",
  },
  {
    title: "Zuteilungsart",
    text: "„Zufällig“ verteilt die Anwesenden ohne weitere Rücksicht. „Ausgewogen“ verteilt sie so, dass die Tische ähnlich stark besetzt sind.",
  },
  {
    title: "Tische berechnen",
    text: "Die berechnete Zuteilung ist sofort auf der öffentlichen Pairing-Seite sichtbar. Sie bleibt dort stehen, bis sie zurückgesetzt wird oder ein Liga-Abend startet.",
  },
  {
    title: "Nachträglich anpassen",
    text: "Zwei Spieler antippen tauscht ihre Plätze — auch über Tische hinweg und auch dann, wenn das eine Gruppe trennt. Ein Tap auf einen Tisch-Titel wählt ihn zum Neumischen aus; ab zwei ausgewählten Tischen werden deren Spieler untereinander neu verteilt, die übrigen Tische bleiben unangetastet.",
  },
  {
    title: "Zurücksetzen",
    text: "Verwirft die Zuteilung und leert die öffentliche Seite. Die Spielerauswahl und die Gruppen bleiben stehen.",
  },
];

export default function CasualInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h1 className="text-xl font-semibold">Casual</h1>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="casual-info"
          aria-label={
            open ? "Erklärung ausblenden" : "Erklärung zum Casual-Modus anzeigen"
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
              open
                ? "border-foreground"
                : "border-black/40 opacity-70 dark:border-white/40"
            }`}
          >
            i
          </span>
        </button>
      </div>

      {open && (
        <div
          id="casual-info"
          className="flex flex-col gap-3 rounded border border-black/20 p-4 dark:border-white/20"
        >
          {TOPICS.map((topic) => (
            <div key={topic.title} className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium">{topic.title}</h2>
              <p className="text-sm opacity-70">{topic.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
