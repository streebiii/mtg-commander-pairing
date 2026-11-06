"use client";

import InfoHeading from "@/components/InfoHeading";

/** Inhalt der Erklärung, in der Reihenfolge des Abends (SPEC.md Abschnitt 5). */
const TOPICS = [
  {
    title: "Abend vorbereiten",
    text: "Legt den Abend an und legt seine Achievements fest. Danach druckst du unter «Punkteblätter drucken» für alle Liga-Teilnehmenden ein Blatt mit eigenem QR-Code, gültig nur für diesen Abend. Wer an der Liga teilnimmt, legst du im Spieler-Tab fest.",
  },
  {
    title: "Anwesenheit",
    text: "Wer im Laden sein Punkteblatt scannt, erscheint von selbst als anwesend. Antippen markiert von Hand als anwesend oder nimmt es zurück, Enter im Suchfeld wählt den einzigen Treffer.",
  },
  {
    title: "Match 1",
    text: "Gepaart wird nach der Rangliste der Saison (Punkte pro besuchter Runde). Das Feld wird in eine obere und eine untere Hälfte geteilt; innerhalb jeder Hälfte sitzen die Spieler zufällig.",
  },
  {
    title: "Warteraum und Live schalten",
    text: "Ein berechnetes Match sieht zuerst nur du. Zwei Spieler antippen tauscht sie, «Neu mischen» würfelt das Match neu. «Live schalten» zeigt sie auf der öffentlichen Seite und den Spielern ihren Tisch auf dem Handy; ab dann können sie ihre Punkte eintragen. Solange an keinem Tisch ein Ergebnis steht, holt «Zurück in den Warteraum» das Match zurück; wer dann dazukommt, wird eingefügt, die anderen bleiben sitzen.",
  },
  {
    title: "Sieger",
    text: "Ist ein Tisch fertig: Spieler antippen und den Pokal, oder «Unentschieden» bei Zeitlimit. Hakt ein Spieler «Winner winner» ab, solange der Tisch offen ist, steht er hier schon als Sieger. Der Pokal setzt dagegen kein «Winner winner» auf dem Blatt — das trägt der Sieger selbst ein. Erst wenn jeder Tisch erfasst ist, startet Match 2.",
  },
  {
    title: "Match 2",
    text: "Die Sieger aus Match 1 rücken 4 Ränge nach oben und spielen innerhalb ihrer Hälfte garantiert gegeneinander. Die übrigen Plätze werden zufällig besetzt, Rematches möglichst vermieden.",
  },
  {
    title: "Drop und Nachzügler",
    text: "Wer geht: Spieler antippen, «Drop». Wer später kommt und sein Blatt scannt, steht in der Seitenleiste unter «Anwesenheit» und wartet, bis du ihn einteilst; ohne Scan wählst du ihn dort aus. Beides geht, bis Match 2 live ist.",
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
