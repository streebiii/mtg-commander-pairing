"use client";

import InfoHeading from "@/components/InfoHeading";

/** Inhalt der Erklärung, in der Reihenfolge des Abends (SPEC.md Abschnitt 5). */
const TOPICS = [
  {
    title: "Anwesende auswählen",
    text: "Antippen markiert einen Liga-Teilnehmenden als anwesend, Enter im Suchfeld wählt den einzigen Treffer. Wer an der Liga teilnimmt, legst du im Spieler-Tab fest.",
  },
  {
    title: "Match 1",
    text: "Gepaart wird nach der Rangliste der Saison (Punkte pro besuchter Runde). Das Feld wird in eine obere und eine untere Hälfte geteilt; innerhalb jeder Hälfte sitzen die Spieler zufällig.",
  },
  {
    title: "Warteraum und Live schalten",
    text: "Ein berechnetes Match sieht zuerst nur du. Zwei Spieler antippen tauscht sie, «Neu mischen» würfelt das Match neu. «Live schalten» zeigt sie auf der öffentlichen Seite; ab dann können sich die Spieler über die Tischkarten anmelden.",
  },
  {
    title: "Sieger",
    text: "Ist ein Tisch fertig: Spieler antippen und den Pokal, oder «Unentschieden» bei Zeitlimit. Hakt ein Spieler «Winner winner» zuerst ab, steht er hier schon als Sieger. Erst wenn jeder Tisch erfasst ist, startet Match 2.",
  },
  {
    title: "Match 2",
    text: "Die Sieger aus Match 1 rücken 4 Ränge nach oben und spielen innerhalb ihrer Hälfte garantiert gegeneinander. Die übrigen Plätze werden zufällig besetzt, Rematches möglichst vermieden.",
  },
  {
    title: "Drop und Nachzügler",
    text: "Wer geht: Spieler antippen, «Drop». Wer später kommt: in der Seitenleiste unter «Anwesenheit» hinzufügen. Beides geht, bis Match 2 live ist.",
  },
  {
    title: "Runde beenden",
    text: "Fragt nach und lässt sich nicht rückgängig machen. Die Achievement-Erfassung bleibt offen, bis du sie unter «Erfassung» schliesst.",
  },
];

/** Überschrift des Liga-Tabs mit aufklappbarer Erklärung — wie im Casual-Tab. */
export default function LeagueInfo({ subtitle }: { subtitle?: string }) {
  return <InfoHeading title="Liga" subtitle={subtitle} topics={TOPICS} />;
}
