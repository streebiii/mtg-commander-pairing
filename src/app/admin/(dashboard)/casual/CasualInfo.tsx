"use client";

import InfoHeading from "@/components/InfoHeading";
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from "@/lib/pairing/groups";

/** Inhalt der Erklärung, in der Reihenfolge des Arbeitsablaufs. */
const TOPICS: { title: string; text: string }[] = [
  {
    title: "Spieler auswählen",
    text: "Antippen markiert einen Spieler als anwesend. Das Suchfeld filtert die Liste, ohne dass Einträge ihre Position wechseln. Wer noch nicht erfasst ist, wird direkt unter dem Suchfeld angelegt — der getippte Name ist dabei schon vorbefüllt.",
  },
  {
    title: "Gruppe bilden",
    text: `Spieler, die zusammen an einen Tisch sollen, lassen sich zu einer Gruppe zusammenfassen (${MIN_GROUP_SIZE} bis ${MAX_GROUP_SIZE} Spieler). Im Gruppen-Modus nimmt ein Tap den Spieler in die entstehende Gruppe auf und markiert ihn gleichzeitig als anwesend.`,
  },
  {
    title: "Zuteilungsart",
    text: "„Zufällig“ verteilt die Anwesenden ohne weiteres Kriterium. „Ausgewogen“ setzt Spieler mit ähnlicher Stufe an denselben Tisch, damit die Partien innerhalb eines Tisches ausgeglichen sind — mit etwas Zufall, damit nicht jedes Mal dieselbe Konstellation entsteht. Wer noch keine Stufe hat, bekommt pro Berechnung eine zufällige zugelost.",
  },
  {
    title: "Tische berechnen",
    text: "Die berechnete Zuteilung landet zuerst im Warteraum: nur du siehst sie. Ein erneutes Berechnen ersetzt sie.",
  },
  {
    title: "Anpassen",
    text: "Zwei Spieler antippen tauscht ihre Plätze — auch über Tische hinweg und auch dann, wenn das eine Gruppe trennt. Ein Tap auf einen Tisch-Titel wählt ihn zum Neumischen aus; ab zwei ausgewählten Tischen werden deren Spieler untereinander neu verteilt, die übrigen Tische bleiben unangetastet.",
  },
  {
    title: "Live schalten",
    text: "Erst jetzt erscheint die Zuteilung auf der öffentlichen Pairing-Seite. Spätere Tausche und Neumischungen sind dort sofort sichtbar. Nach 24 Stunden gilt eine Zuteilung als abgelaufen und verschwindet von selbst.",
  },
  {
    title: "Zurücksetzen",
    text: "Verwirft die Zuteilung und leert die öffentliche Seite. Die Spielerauswahl und die Gruppen bleiben stehen.",
  },
];

/** Überschrift des Casual-Tabs mit aufklappbarer Erklärung. */
export default function CasualInfo() {
  return <InfoHeading title="Casual" topics={TOPICS} />;
}
