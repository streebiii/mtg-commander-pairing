# Backlog

Ideen und zukünftige Vorhaben. Die Liga-Einträge stammen aus der
Konzept-Session zum Liga-Abend und sind entscheidungsreif — die
Grundsatzfragen sind dort beantwortet, offen ist jeweils nur noch die
Umsetzung.

## Wie der Liga-Abend wirklich abläuft

Ergebnis der Konzept-Session. Diese Beschreibung ist die Grundlage aller
Liga-Einträge unten; sie weicht in wesentlichen Punkten von SPEC.md
Abschnitt 5 ab.

- Alle Anwesenden sind vor Beginn da, die Teilnehmerliste steht fest und
  ändert sich während des Abends nicht.
- Es werden **immer genau zwei Runden** gespielt.
- **Runde 1** wird nach dem Saisonstand von mtgbl.ch gepaart (kommt über
  den bestehenden Import in die App, manuell, ohne Erinnerung).
- **Runde 2 paart die Gewinner der ersten Runde untereinander.** Wer
  gewonnen hat, steht sofort nach der Partie fest — im Gegensatz zu den
  Achievement-Punkten.
- Die **Achievement-Zettel werden erst am Ende des Abends abgegeben.**
  Während des Abends existiert kein aktualisierter Punktestand.
- Die **offizielle Wertung liegt auf mtgbl.ch** und bleibt dort. Die App
  löst sie nicht ab; sie liefert zu.

**Warum der Liga-Tab bisher ungenutzt blieb:** Die App verlangt vor
Runde 2 für jeden Spieler ein eingetragenes Ergebnis
(`startNextRound` in `src/app/admin/(dashboard)/league/actions.ts`).
Genau das gibt es zu diesem Zeitpunkt nicht — die Zettel kommen erst
später. Gleichzeitig ignoriert sie die Information, die vorliegt: wer
gewonnen hat. Die Paarung von Hand war die einzig mögliche Reaktion.

## Liga-Abend: Sieger statt Punktsumme

**Status:** Fertig gegrillt, bereit zur Umsetzung.

**Worum es geht:** Der Liga-Abend wird auf den tatsächlichen Ablauf
umgebaut. Kern ist der Wechsel des Sortierschlüssels für Runde 2: nicht
mehr der Saison-Punktestand, sondern der Sieg aus Runde 1.

**Entschieden:**
- Nach jeder Partie tippst du in der Tischkachel den **Gewinner** an —
  eine Angabe pro Tisch, kein Formular.
- **Runde 2 sortiert nach Sieg**, danach greift die bestehende
  Rang-Gruppierung samt Rematch-Vermeidung unverändert weiter. Das
  entspricht den von TopDeck.gg empfohlenen „Swiss pods" und skaliert
  ohne Sonderfälle: zwei Gewinner sitzen zusammen am Kopftisch und der
  wird aufgefüllt, fünf Gewinner ergeben von selbst einen reinen
  Gewinnertisch.
- **Unentschieden kommen vor.** Wird kein Gewinner gewählt, zählen alle
  an diesem Tisch als ohne Sieg.
- **`MAX_ROUNDS` wird 2.** Nach Runde 2 bietet die App keine dritte an,
  sondern den Abschluss.
- Die **Punkteeingabe pro Runde entfällt** ersatzlos — sie hat mit dem
  neuen Sortierschlüssel keinen Zweck mehr. Punkte werden nur noch am
  Abendende erfasst (eigener Eintrag unten).
- Runde 1 bleibt beim importierten Saisonstand.

**Zu beachten:**
- `submitRoundResults` und die Punktespalten in `page.tsx` fallen weg;
  `TableAssignment.pointsAwarded` wird dadurch unbenutzt. Feld erst
  entfernen, wenn die Abendend-Erfassung steht — sonst geht die einzige
  Stelle verloren, an der ein Ergebnis hängen kann.
- `startNextRound` verliert die Ergebnis-Sperre und bekommt stattdessen
  eine Sieger-Sperre: Runde 2 erst, wenn für jeden Tisch entschieden
  ist, ob es einen Gewinner gab. „Kein Gewinner" muss dabei ein
  bewusster Zustand sein, nicht dasselbe wie „noch nicht erfasst".
- **SPEC.md Abschnitt 5 muss neu geschrieben werden**, nicht ergänzt.
  Schritt 3 und 4 des dortigen Ablaufs beschreiben etwas, das es danach
  nicht mehr gibt.
- Schema: ein Feld für den Sieger pro Tisch (oder ein Flag pro
  `TableAssignment`). Additiv, Migration vor dem Merge einspielen.

**Nächster Schritt:** Direkt umsetzen. Zuerst, weil alle anderen
Liga-Einträge darauf aufbauen.

## Abendabschluss: Achievements erfassen und ausgeben

**Status:** Fertig gegrillt, bereit zur Umsetzung.

**Worum es geht:** Am Ende des Abends tippst du die Zettel in die App,
sie rechnet die Summen und gibt sie in dem Format aus, das du auf
mtgbl.ch einfügen kannst.

**Entschieden:**
- Erfasst wird durch **Ankreuzen der Achievements**, nicht durch Eintippen
  eines Totals — die App bildet die Summe. Damit stimmt sie garantiert,
  und man sieht später, welche Achievements häufig erreicht werden.
- **Je Runde eine eigene Spalte** pro Spieler (Runde 1 und Runde 2), weil
  Teilnahme und Sieg **pro Match** zählen. Die Deckbau-Achievements
  stehen als einfaches Häkchen pro Abend daneben.
- **Ausgabe im mtgbl-Format zum Kopieren** — dasselbe Tabellenformat, das
  der bestehende Import liest (`| # | Spieler | F | Total | R1 | R2 | ... |`).
  Import und Export werden damit zum Spiegelbild.

**Zu beachten:**
- Die Maske wird breit: 25 Achievements × 2 Runden × alle Anwesenden.
  Auf dem Handy ist das der kritische Fall — vermutlich ein Spieler nach
  dem anderen statt einer Gesamttabelle.
- Teilnahme und Sieg kann die App **vorbelegen**: wer an einem Tisch
  sass, war anwesend, und der Sieger ist bereits erfasst. Das nimmt
  schon zwei der häufigsten Häkchen ab.
- **Offen und bewusst als Annahme markiert:** `Player.points` bleibt die
  Kopie des Saisonstands von mtgbl.ch und wird von der Erfassung **nicht**
  fortgeschrieben. Aktualisiert wird er beim nächsten Import. Sonst gäbe
  es zwei Quellen für dieselbe Zahl.

**Nächster Schritt:** Umsetzen, nachdem der Sieger-Umbau steht.

## Achievement-Katalog und Ziehung der rotierenden

**Status:** Fertig gegrillt, bereit zur Umsetzung.

**Worum es geht:** Die Achievements liegen als pflegbare Stammdaten in
der App, und die App zieht nach jedem Abend die rotierenden für das
nächste Mal.

**Entschieden:**
- **Katalog in der Datenbank**, in der App verwaltbar: Name, Punktwert,
  Kategorie (fix, Deckbau, rotierend). Keine Code-Änderung nötig, wenn
  sich etwas ändert.
- Pro Abend gelten **6 fixe, 9 Deckbau und 10 rotierende** — die 25 von
  mtgbl.ch. (In der Session fiel kurz die Zahl 15 für die rotierenden;
  auf Nachfrage bestätigt: es bleiben 10.)
- Die Ziehung passiert **automatisch beim Abschluss eines Abends** und
  gilt für den nächsten. Das Ergebnis wird zum Kopieren angezeigt, damit
  es vorher angekündigt werden kann.
- **Reiner Zufall**, keine Ausschlussregel — dasselbe Achievement darf
  zweimal hintereinander gelten.

**Zu beachten:**
- Ein Abend braucht damit eine feste Zuordnung, welche 25 an ihm galten
  — sonst lässt sich eine alte Erfassung später nicht mehr lesen. Der
  Katalog darf sich ändern, ohne vergangene Abende umzuschreiben.
- Der erste Abend hat keinen Vorgänger, aus dem gezogen wurde. Es braucht
  einen Weg, die geltenden Achievements auch von Hand zu setzen.

**Nächster Schritt:** Umsetzen, zusammen mit oder nach der
Abendend-Erfassung — sie braucht den Katalog.

## Saison als eigenes Objekt

**Status:** Grundsatz entschieden, Details offen.

**Worum es geht:** Abende gehören zu einer Saison. Saison-Achievements
wie „Evergreen" (+7 für dasselbe Deck über die ganze Saison) werden
**einmal am Saisonende** erfasst und brauchen dafür eine Stelle.

**Zu beachten:**
- Heute kennt das Schema keine Saison (`Evening` steht für sich). Das ist
  die grösste Schema-Änderung der ganzen Liga-Umstellung.
- Ein Saisonwechsel muss den Punktestand sauber zurücksetzen können, ohne
  die alten Abende zu verlieren.
- Hängt an nichts, blockiert aber auch nichts — kann zuletzt kommen.

**Nächster Schritt:** Eigene Grill-Session zu Schema und Saisonwechsel,
bevor gebaut wird.

## Liga: Knopf "alle Spieler auswählen"

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Beim Start eines Liga-Abends muss der Organisator
aktuell jeden anwesenden Spieler einzeln antippen (Checkbox-Liste in
`src/app/admin/(dashboard)/league/page.tsx`). Bei fast vollständiger
Anwesenheit ist das viel Klickarbeit. Gewünscht ist ein Knopf, der alle
auf einmal auswählt.

**Zu beachten bei der Umsetzung:**
- Die Auswahl steckt in einem klassischen `<form>` mit
  `<input type="checkbox" name="playerIds">`, gerendert von einer
  **Server-Komponente**. Ein Umschalten braucht Zustand, also eine kleine
  Client-Komponente — entweder für den Knopf allein (setzt die Checkboxen
  im umgebenden Formular) oder für die ganze Liste.
- Sinnvoll als **Umschalter**: "alle auswählen" bzw. "Auswahl aufheben",
  je nachdem ob schon alle angehakt sind. Sonst braucht es zwei Knöpfe.
- Es erscheinen ohnehin nur Liga-teilnehmende Spieler in der Liste
  (`leagueActive`), "alle" heisst also "alle Teilnehmenden" — nicht das
  gesamte Vereins-Roster.
- 44px Klickfläche wie überall.

**Nächster Schritt:** Direkt umsetzen.

## Liga-Verwaltung zeigt nur noch Liga-Teilnehmer

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Die Liga-Verwaltung
(`src/app/admin/(dashboard)/league/page.tsx`) listet heute **alle**
Vereinsspieler mit Punktestand und Teilnahme-Checkbox. Künftig sollen
dort nur noch die tatsächlich Teilnehmenden stehen (`leagueActive`).
Wer den Haken nicht gesetzt hat, taucht ausschliesslich im Spieler-Tab
auf.

**Aufgenommen wird weiterhin im Spieler-Tab** — die Checkbox dort
(`PlayerRow.tsx`) existiert bereits und bleibt der Weg, jemanden zur Liga
hinzuzufügen. Die Liga-Verwaltung wird damit zur reinen Pflege der
Teilnehmenden.

**Zu entscheiden bei der Umsetzung:** ob die Teilnahme-Spalte in der
Liga-Verwaltung ganz verschwindet (dann nur noch Punkte, Entfernen läuft
über den Spieler-Tab) oder als Weg zum Herausnehmen bestehen bleibt. Ein
Haken, den man dort abwählt, lässt die Zeile sofort verschwinden — das
sollte nicht wie ein Fehler wirken.

**Ausserdem anzupassen:** Der Hinweistext in der Liga-Verwaltung ("nur
teilnehmende Spieler erscheinen in der Auswahlliste für neue
Liga-Abende") und die Anzahl in der Überschrift beziehen sich heute auf
alle Spieler.

**Nächster Schritt:** Direkt umsetzen.
