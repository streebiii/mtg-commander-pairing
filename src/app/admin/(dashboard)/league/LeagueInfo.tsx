"use client";

import InfoHeading from "@/components/InfoHeading";

/** Inhalt der Erklärung, in der Reihenfolge des Abends (SPEC.md Abschnitt 5). */
const TOPICS = [
  {
    title: "Anwesende auswählen",
    text: "Antippen markiert einen Liga-Teilnehmenden als anwesend, Enter im Suchfeld wählt den einzigen Treffer. Wer an der Liga teilnimmt, legst du im Spieler-Tab fest.",
  },
  {
    title: "Runde 1",
    text: "Gepaart wird nach der Rangliste der Saison (Punkte pro besuchtem Abend). Das Feld wird in eine obere und eine untere Hälfte geteilt; innerhalb jeder Hälfte sitzen die Spieler zufällig.",
  },
  {
    title: "Warteraum und Live schalten",
    text: "Eine berechnete Runde sieht zuerst nur du. Zwei Spieler antippen tauscht sie, «Neu mischen» würfelt die Runde neu. «Live schalten» zeigt sie auf der öffentlichen Seite; ab dann können sich die Spieler über die Tischkarten anmelden.",
  },
  {
    title: "Sieger",
    text: "Ist ein Tisch fertig: Spieler antippen und die Krone, oder «Unentschieden» bei Zeitlimit. Erst wenn jeder Tisch erfasst ist, startet Runde 2.",
  },
  {
    title: "Runde 2",
    text: "Die Sieger aus Runde 1 rücken nach oben, Rematches werden möglichst vermieden.",
  },
  {
    title: "Drop und Nachzügler",
    text: "Wer geht: Spieler antippen, «Drop». Wer später kommt: in der Seitenleiste unter «Anwesenheit» hinzufügen. Beides geht, bis Runde 2 live ist.",
  },
  {
    title: "Abend beenden",
    text: "Fragt nach und lässt sich nicht rückgängig machen. Die Achievement-Erfassung bleibt offen, bis du sie unter «Erfassung» schliesst.",
  },
];

/** Überschrift des Liga-Tabs mit aufklappbarer Erklärung — wie im Casual-Tab. */
export default function LeagueInfo({ subtitle }: { subtitle?: string }) {
  return <InfoHeading title="Liga" subtitle={subtitle} topics={TOPICS} />;
}
