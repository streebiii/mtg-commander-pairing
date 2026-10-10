# Backlog

Ideen und zukünftige Vorhaben. Die Liga-Einträge stammen aus der
Konzept-Session zum Liga-Abend und sind entscheidungsreif — die
Grundsatzfragen sind dort beantwortet, offen ist jeweils nur noch die
Umsetzung.

## Liga: Nicht-4er-Tische nach unten drücken, Wiederholungen und Sieger-Zusammensitz

**Status:** Entschieden und umgesetzt (Session vom 15.09.2026), siehe
`src/lib/pairing/leagueAssignment.ts` (`verbessereZuteilung`,
`waehleHaelftenGrenze`).

**Drei Ergänzungen zur Hälften-Zuteilung** (siehe Eintrag unten):
1. **3er-Tische bevorzugt unten**: wo die Halbierung eine Wahl lässt
   (mehrere gleichwertige Aufteilungen mit derselben Gesamtzahl an
   Nicht-4er-Tischen, z.B. Grenze 4 oder 7 bei 11 Anwesenden), gewinnt
   die Variante, die den Nicht-4er-Tisch in die untere statt die obere
   Hälfte legt.
2. **Wiederholte Nicht-4er-Zuteilung vermeiden**: wer an diesem Abend
   schon an einem Nicht-4er-Tisch sass, wird beim Tausch-Optimierer
   bevorzugt nicht noch einmal dorthin gesetzt (`loadEveningHistory`
   in leagueHistory.ts).
3. **Sieger bevorzugt zusammen**: derselbe Optimierer erhöht zusätzlich
   die Chance, dass zwei Sieger der Vorrunde am selben Tisch landen.
   Empirisch sehr stark — in einem Testfall ohne konkurrierende
   Kriterien clusterten alle Sieger bei 1000 von 1000 Ziehungen komplett
   zusammen (nicht nur "häufiger"). Bewusst akzeptiert: Sieger wechseln
   jede Runde, anders als der stabile Saison-Rang, der zum ursprünglichen
   Top-5-Problem führte — keine feste Clique zu erwarten.

Alle drei Kriterien (plus die bestehende Rematch-Vermeidung) laufen in
einem gemeinsam gewichteten Tausch-Optimierer (`bewerteTisch`), nicht
nacheinander — Gewichte: Rematch (3) > wiederholter Nicht-4er (2) >
Sieger-Zusammensitz (1). Tauscht nie über die Hälften-Grenze hinweg.

## Liga: Rang-Rauschen durch Hälften-Zuteilung ersetzt

**Status:** Entschieden und umgesetzt — Rang-Rauschen komplett entfernt,
siehe `src/lib/pairing/leagueAssignment.ts` (`assignLeagueRound`).

**Vorgeschichte:** Ursprünglich sortierte die Zuteilung nach Rang +
Zufalls-Rauschen (`RANG_RAUSCHEN`) und teilte in aufeinanderfolgende
Rang-Blöcke ein. Zwei Probleme kamen dabei ans Licht:

1. Zwei Spieler konnten sich bei bis zu **2×RANG_RAUSCHEN** Rängen
   Abstand begegnen, nicht nur bei ±RANG_RAUSCHEN — beobachtet live bei
   ±10: Marc S (Rang 1) und Danilo (Rang 16, Abstand 15) sassen nach
   beiderseitigem Sieg-Bonus zusammen. `RANG_RAUSCHEN` wurde daraufhin
   von 10 auf 7 reduziert.
2. **Die eigentlich wichtigere Erkenntnis (Session vom 11.09.2026):**
   die besten Ränge häuften sich weiterhin extrem oft an einem Tisch —
   eine Simulation zeigte >80% Chance, dass mindestens 3 der besten 5
   Spieler zusammensitzen, selbst bei ±15 Rauschen. Eine
   Kontrollmessung mit rein zufälliger Verteilung (ganz ohne Rang-Bezug)
   lag bei nur ~16% — der Effekt lag also an der Rang-Block-Paarung
   selbst, nicht an der Rauschstärke. Genauer: es ist ein **Rand-Effekt**
   — Spitze und Tabellenende eines begrenzten Feldes häufen sich fast
   identisch stark (beide ~83%), das Mittelfeld deutlich weniger (~27%),
   weil Rand-Positionen nur von einer Seite "Verkehr" durch Mitbewerber
   bekommen. Zwei naheliegende Gegenmassnahmen (Rauschen an den Rändern
   verstärken, Rand-Spiegelung/Phantom-Kandidaten) wurden simuliert und
   verworfen: Ersteres bräuchte unpraktikabel grosses Rauschen, um die
   Mitte zu erreichen; Letzteres funktionierte technisch gar nicht
   (Phantome ohne echten Sitzplatz beeinflussen die relative Sortierung
   echter Spieler nicht).

**Entscheidung:** Das gesamte Rausch-Modell wurde durch ein einfacheres,
empirisch deutlich besseres Modell ersetzt (inspiriert von einer
bewährten manuellen Praxis des Organisators): das Feld wird nach Rang in
eine obere und eine untere Hälfte geteilt (die untere spielt nie gegen
die obere), innerhalb jeder Hälfte wird komplett zufällig zugeteilt.
Die Grenze liegt dabei nicht stur bei der exakten Mitte, sondern dort,
wo insgesamt die wenigsten Nicht-4er-Tische entstehen (siehe
`waehleHaelftenGrenze` in leagueAssignment.ts — ein früher Entwurf mit
fixer Mitte + kleiner Zufalls-Verschiebung erzeugte bei durch 4 teilbaren
Anwesendenzahlen wie 28 unnötige 3er-Tische, 14/14 statt 12/16). Gibt es
mehrere gleichwertige Grenzen, wird zufällig eine gewählt — das sorgt
nebenbei dafür, dass Spieler direkt an der Grenze (z.B. Rang 14/15 bei 28
Anwesenden) sich nicht künstlich nie begegnen. Ergebnis (Simulation
gegen den echten Code): Top-5-Häufung sinkt von 83% auf ~24%, während
Rang 1 in 100'000 Testziehungen kein einziges Mal auf die untersten
Ränge trifft. `RANG_RAUSCHEN` und `TAUSCH_TOLERANZ_RAENGE` entfallen
ersatzlos; `SIEG_BONUS_RAENGE` bleibt (auf 4 Ränge leicht erhöht), wirkt
sich jetzt aber primär an der Hälften-Grenze aus, nicht mehr durchgehend
über die ganze Rangliste.

## Wie der Liga-Abend wirklich abläuft

Ergebnis der Konzept-Session. Diese Beschreibung ist die Grundlage aller
Liga-Einträge unten. SPEC.md Abschnitt 5 ist inzwischen danach neu
geschrieben; der Abschnitt «Warum der Liga-Tab bisher ungenutzt blieb»
beschreibt den Stand davor.

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
- Laut https://mtgbl.ch/liga/commander/2026/regeln: Pods zu **3 bis 5
  Spielern, Priorität 4 > 3 > 5**; Spiele auf **120 Minuten** begrenzt,
  danach endet die Partie **unentschieden**; zwischen zwei Terminen
  dürfen höchstens **15 Karten** getauscht werden. Eine Saison umfasst
  **6 Liga-Abende** mit festen Terminen.
- Die Casual-Option „5er-Tisch erlauben" (SPEC.md Abschnitt 3.1) berührt
  die Liga **nicht** — dort wird weiterhin ohne sie gerechnet, die
  Vereinsregel 4 > 3 > 5 gilt also unverändert.
- **Die gezogenen rotierenden Achievements müssen nach jedem Abend
  veröffentlicht werden** — die Spieler dürfen ihr Deck anschliessend
  gezielt darauf anpassen (max. 15 Karten). Die Ziehung ist damit keine
  Bequemlichkeit, sondern Teil der Liga-Regeln.

**Warum der Liga-Tab bisher ungenutzt blieb:** Die App verlangt vor
Runde 2 für jeden Spieler ein eingetragenes Ergebnis
(`startNextRound` in `src/app/admin/(dashboard)/league/actions.ts`).
Genau das gibt es zu diesem Zeitpunkt nicht — die Zettel kommen erst
später. Gleichzeitig ignoriert sie die Information, die vorliegt: wer
gewonnen hat. Die Paarung von Hand war die einzig mögliche Reaktion.

## Liga-Abend: Runde 2 paart nach dem Tischsieger

**Status:** Umgesetzt — Sieger pro Tisch (`TableAssignment.isWinner`,
Unentschieden über `Table.resultEnteredAt` ohne Sieger), `MAX_ROUNDS = 2`, SPEC.md
Abschnitt 5 neu geschrieben. Die Punkte erfassen die Spieler selbst
(Eintrag «Spieler erfassen ihre Achievements selbst»).

**Worum es geht:** Der Liga-Abend wird auf den tatsächlichen Ablauf
umgebaut. Kern ist der Wechsel des Sortierschlüssels für Runde 2: nicht
mehr der Saison-Punktestand, sondern der Sieg aus Runde 1.

**Nicht zu verwechseln:** „Sieger" meint hier ausschliesslich, wer seinen
Tisch in Runde 1 gewonnen hat — den Sortierschlüssel für die zweite
Paarung. Wer den Abend oder die Saison gewinnt, entscheidet weiterhin die
höchste Punktsumme, und das bleibt Sache von mtgbl.ch.

**Warum nicht nach Punktsumme sortieren?** Zwei Gründe. Erstens existiert
sie zum Zeitpunkt der Paarung nicht — die Zettel kommen erst am Ende des
Abends. Zweitens würde sie das Falsche messen: ein grosser Teil der
Punkte steht fest, bevor die erste Karte liegt. Pauper (+4), Evergreen
(+7) und No Sol Ring (+1) ergeben zusammen **+12 ohne eine gespielte
Partie**, während ein gewonnenes Match **+1** bringt. Eine Sortierung
nach Punktsumme würde die Spieler also nach ihrer Deckwahl an die Tische
setzen statt nach dem Verlauf der Runde.

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

## Spieler erfassen ihre Achievements selbst

**Status:** Umgesetzt (10.10.2026), siehe SPEC.md Abschnitt 12. Ersetzt
den früheren Entwurf, in dem der Organisator die Papierzettel abtippt
und eine mtgbl-Tabelle ausgibt. Zusätzlich entschieden bei der
Umsetzung: ein neuer Liga-Abend schliesst eine noch offene Erfassung
automatisch.

**Worum es geht:** Die Spieler melden sich ohne Konto am laufenden
Liga-Abend an und haken ihre Achievements auf dem Handy selbst ab —
laufend während des Abends oder gesammelt am Schluss. Der Organisator
prüft und schliesst die Erfassung.

**Entschieden:**
- **Zugang über feste Tischkarten:** ein PDF mit QR-Codes für Tisch 1–6,
  einmal gedruckt und dauerhaft gültig, im Organisator-Bereich erzeugt.
  Der QR führt zum Tisch; dort stehen die Spieler, die in der aktuellen
  Runde an diesem Tisch sitzen. Name antippen, fertig. Funktioniert nur,
  solange ein Liga-Abend läuft. Kein Abend-Code, kein Konto.
- **Ein Name pro Gerät:** sobald ein Gerät einen Namen gewählt hat, ist er
  für andere Geräte gesperrt; der Organisator kann ihn wieder freigeben
  (z.B. Handywechsel). Das Gerät merkt sich den Namen für den Abend.
- **Nur für sich selbst.** Wer kein Handy hat, gibt weiter den
  Papierzettel ab; der Organisator erfasst für ihn in der App.
- **Liste pro Spieler:** je Spiel (Runde 1, Runde 2) die fixen und
  rotierenden Achievements zum Abhaken, Deckbau einmal pro Abend; bei
  «pro Spieler» und «mehrmals pro Abend» ein Anzahl-Feld. Oben die
  laufende Summe mit Teilsummen Core / Deckbau / Rotate wie auf dem
  Zettel. Grundlage sind die eingefrorenen Achievements des Abends.
- **Vorbelegt:** «Participation» ist für jede gespielte Runde gesetzt
  (nicht änderbar). «Winner winner» trägt der Spieler selbst ein.
- **Abgeben:** der Spieler tippt «Abgeben», danach ist seine Liste
  gesperrt. Der Organisator sieht pro Spieler offen / abgegeben, kann
  korrigieren und eine Abgabe wieder öffnen.
- **Zeitfenster:** offen ab Abendstart, auch nach «Abend beenden» — bis
  der Organisator die Erfassung schliesst. Erst dann zählt der Abend in
  der Rangliste.
- **Evergreen** («1x am Ende der Liga») erscheint nur am letzten Abend
  der Saison. Welcher Abend welcher ist (R1–R6), leitet die App aus den
  Terminen auf mtgbl.ch ab (24.04., 22.05., 14.08., 11.09., 16.10.,
  06.11.2026); bei Verschiebungen bewusst in Kauf genommen.
- **Commander und Farbidentität** werden hier nicht erfasst — sie werden
  einmal initial pro Saison hinterlegt (siehe Saison-Eintrag).

**Zu beachten:**
- Die Tischkarten sind dauerhaft gültig und damit nicht geheim; Schutz
  bieten die Namenssperre, die Beschränkung auf die Spieler des Tisches
  und die Prüfung durch den Organisator.
- Spieler, die nur Runde 1 gespielt haben, sehen keine Spalte für
  Runde 2.
- Neue öffentliche Routen ausserhalb von `/admin` — dürfen nur Lese- und
  eigene Schreibzugriffe für den gewählten Spieler erlauben.
- Schema: Erfassung pro Spieler, Abend-Achievement und Spiel (mit
  Anzahl), Abgabe-Status pro Spieler und Abend, Geräte-Zuordnung,
  Erfassung-geschlossen am Abend. Additiv.

**Nächster Schritt:** Öffentliche Rangliste (Eintrag unten).

## Liga-Punkte aus der Erfassung übernehmen

**Status:** Offen, bewusst zurückgestellt (Bereinigung vom 10.10.2026).

**Worum es geht:** Die App erfasst die Achievement-Punkte inzwischen
selbst, gepaart wird Runde 1 aber weiterhin nach `Player.points` und
`attendedEvenings` — beides kommt nur über den Import von mtgbl.ch, wohin
die Punkte wiederum aus der App gelangen. Nach dem Schliessen einer
Erfassung könnten Punkte und Abendzahl direkt aus den Einträgen
nachgeführt werden; der Import bräuchte es dann nur noch für die Abende
vor der App.

**Zu beachten:**
- `TableAssignment.pointsAwarded` ist seit der Sieger-Erfassung unbenutzt.
  Entfernen gehört zu diesem Schritt — die Spalte trägt noch Werte alter
  Abende.
- Hängt eng mit der öffentlichen Rangliste (unten) zusammen.

## Tischkarten bei offener Erfassung und Casual-Abend

**Status:** Offen, klein (Bereinigung vom 10.10.2026).

Die Erfassung eines Liga-Abends bleibt nach «Abend beenden» offen, bis der
Organisator sie schliesst. Findet in dieser Zeit ein Casual-Abend statt,
zeigen die Tischkarten-QR-Codes (`/tisch/<nr>`) weiterhin die Spieler des
letzten Liga-Tisches. Im Alltag unwahrscheinlich, weil die Erfassung vorher
geschlossen wird; falls doch, wäre der einfachste Weg, die Tischseite bei
einer live geschalteten Casual-Zuteilung auszublenden.

## Öffentliche Rangliste mit Achievements

**Status:** Gegrillt (Session vom 10.10.2026), Gestaltungsvorschlag
gemacht, bereit zur Umsetzung nach der Selbsterfassung.

**Worum es geht:** pairings.mtgbl.ch zeigt eine Rangliste wie
https://mtgbl.ch/liga/commander/2026/rangliste — zusätzlich mit den
erreichten Achievements pro Abend.

**Entschieden:**
- **Spalten wie auf mtgbl.ch:** Δ, #, Spieler, F (Farbidentität, als
  farbige Punkte), Total, R1–R6.
- **Achievement-Details pro Abend:** Punktzahlen aus der App sind
  markiert; Überfahren (Desktop) oder Antippen (Handy) zeigt darunter die
  Aufschlüsselung Spiel 1 / Spiel 2 / Deckbau mit Achievements und
  Teilsummen.
- **Abende vor der App (R1–R4)** kommen über den erweiterten Import: er
  speichert künftig die Punkte pro Abend und die Farbidentität (F), nicht
  nur Total und Anzahl. Für diese Abende gibt es keine Details.
- Ein Abend erscheint erst, wenn der Organisator die Erfassung
  geschlossen hat.
- **Streichresultat** (laut mtgbl.ch zählt das schlechteste Resultat
  nicht): während der Saison Summe aller Abende, erst nach Abend 6 wird
  das schlechteste gestrichen und durchgestrichen angezeigt.
- Die Rangliste auf mtgbl.ch wird später automatisch aktualisiert — eine
  Kopier-Ausgabe für mtgbl.ch braucht es vorerst nicht.

**Zu beachten:**
- `Player.points` ist heute die Kopie des mtgbl-Totals; mit der
  Rangliste wird das Total aus den Abendpunkten berechnet. Klären, ob
  `points` dann nur noch für die Paarung von Runde 1 dient.
- Δ = Rangveränderung gegenüber dem Stand vor dem letzten Abend.

## Achievement-Katalog und Auswahl der rotierenden

**Status:** Umgesetzt (08./09.10.2026), siehe SPEC.md Abschnitt 11.
Ersetzt den früheren Entwurf mit Zufallsziehung in der App.

**Worum es geht:** Die Achievements liegen als pflegbare Stammdaten in
der App. Pro Abend gelten 25: alle 6 fixen und 9 Deckbau-Achievements
automatisch, dazu die 10 rotierenden der aktuellen Ziehung — es gilt,
was im Katalog aktiv ist.

**Entschieden:**
- **Die Ziehung macht die Website, nicht die App.** mtgbl.ch zieht die
  10 rotierenden am Ende eines Abends für den nächsten und
  veröffentlicht sie (z.B. «Rotierende Achievements 16.10.26»). Die App
  übernimmt sie nur. Eine Zufallsziehung in der App entfällt.
- **Eigener Tab «Achievements»** in der Navigation, neben Liga und
  Spieler. Dort: Katalog nach Kategorie (fix, Deckbau, rotierend),
  anlegen, ändern, aktiv/inaktiv stellen.
- **Katalog einmal mitliefern:** die Liste von
  https://mtgbl.ch/liga/commander/2026/achievements wird als Startdaten
  übernommen (Stand 08.10.2026: 6 fixe, 9 Deckbau, 76 rotierende).
  Danach wird nur noch in der App gepflegt. Massgeblich bleibt die
  Website, die Dateien in `information-files/` sind veraltet.
- **Punkte als Zahl, Mehrfach-Zählung über die Art:** ein fester
  Punktwert pro Erfüllung. Die Art kennt neben «1x pro Match», «1x pro
  Abend» und «1x am Ende der Liga» auch **«pro Spieler»** und
  **«mehrmals pro Abend»** — beide zählen mehrfach und bekommen bei der
  Erfassung ein Anzahl-Feld statt eines Häkchens (`Commander Classic
  Win`, «+1/Spieler», ist «pro Spieler»). Ein eigenes Flag «mehrfach»
  gibt es nicht (Korrektur vom 08.10.2026). `It's Good to Be the King/Queen`
  («+2/+1») ist ebenfalls «pro Spieler» und wird als +2 geführt; die +1
  für Spätere wird bei Bedarf bei der Erfassung korrigiert. Alle übrigen
  rotierenden zählen «1x pro Match», wie auf dem Punkteblatt vom
  22.05.2026.
- **Aktiv heisst «gilt am nächsten Liga-Abend»** (Entscheid vom
  09.10.2026, ersetzt die frühere Kachel-Auswahl): bei den rotierenden
  stellst du nach jeder Ziehung im Katalog die neuen 10 aktiv und die
  bisherigen inaktiv. Ein separates «deaktiviert» gibt es nicht —
  nicht gezogene rotierende sind schlicht inaktiv. Gepflegt wird **nur
  im Achievements-Tab**, der Schritt «Abend beenden» bleibt unverändert.
- **Abendstart übernimmt alle aktiven** und lässt den Katalog
  unverändert; die rotierenden bleiben aktiv bis zur nächsten Umstellung.
- **Keine Korrektur am laufenden Abend** — ein gestarteter Abend behält
  seine Liste.
- **Keine Anzahl-Sperre** — die 10 werden von der Website übernommen.
  Zur Kontrolle zeigt der Katalog «10 von 76 aktiv».
- **Die Ziehung vom 16.10.2026 wird mitgeliefert**: diese 10 rotierenden
  sind in den Startdaten aktiv — Fog, Boundless Realms, Smash!,
  Commander Classic Win, The Sheriff is Near, Necropotence, Crumbling
  Sanctuary, Endurance, Fateful Hour, Serial Killer.
- **Der Abend friert eine Kopie ein:** beim Start kopiert der Abend
  Titel, Beschreibung, Punkte, Kategorie und Art seiner 25.
  Katalogänderungen wirken nur auf künftige Abende. Entfernen heisst
  inaktiv stellen, nie löschen.
- **Öffentliche Lese-Ansicht** (SPEC.md Abschnitt 11.3) zeigt beim
  laufenden Abend die 25 geltenden Achievements.

- **Katalog als drei Tabellen im Stil von CRM-Listen**, umgeschaltet
  über Reiter mit Anzahl: Suche, Filter nach Art und Status, sortierbare
  Spalten, Titel und Beschreibung als getrennte Spalten, Bearbeiten per
  Klick in die Zelle, «Aktiv» als Schalter. Angelegt wird in einem
  Seitenpanel.

**Zu beachten:**
- Die Art (pro Match, pro Abend, am Ende der Liga) folgt aus der
  Kategorie, mit Evergreen als einziger Ausnahme. Damit die Ausnahme
  nicht im Code steckt, wird die Art als eigenes Feld gespeichert und
  beim Mitliefern aus der Kategorie vorbelegt.
- Schema-Änderung (Katalog, Abend-Kopie), additiv.

**Nächster Schritt:** Die Selbsterfassung durch die Spieler (Eintrag
«Spieler erfassen ihre Achievements selbst» oben).

## Saison als eigenes Objekt

**Status:** Grundsatz entschieden, Details offen.

**Worum es geht:** Abende gehören zu einer Saison. Saison-Achievements
wie „Evergreen" (+7 für dasselbe Deck über die ganze Saison) werden
**einmal am Saisonende** erfasst und brauchen dafür eine Stelle.

**Vereinfachung aus dem Punkteblatt:** Evergreen ist dort kein Sonderfall
neben dem Modell, sondern trägt schlicht die Art `1x am Ende der Liga` —
denselben Mechanismus wie `1x pro Match` und `1x pro Abend`. Wer die Art
sauber umsetzt, bekommt die Saison-Achievements ohne eigenen Weg.

**Zu beachten:**
- Heute kennt das Schema keine Saison (`Evening` steht für sich). Das ist
  die grösste Schema-Änderung der ganzen Liga-Umstellung.
- Eine Saison umfasst **6 Abende mit festen Terminen** und hat pro Spieler
  eine **ausgeloste Farbidentität** — beides Saison-Daten, die es heute
  nirgends gibt. Die Farbidentität steht auf jedem Punkteblatt.
- Ein Saisonwechsel muss den Punktestand sauber zurücksetzen können, ohne
  die alten Abende zu verlieren.
- Hängt an nichts, blockiert aber auch nichts — kann zuletzt kommen.

**Nächster Schritt:** Eigene Grill-Session zu Schema und Saisonwechsel,
bevor gebaut wird.

## Liga-Verwaltung zeigt nur noch Liga-Teilnehmer

**Status:** Umgesetzt. Die Liga-Verwaltung
(`src/app/admin/(dashboard)/league/page.tsx`) listet nur noch Spieler
mit `leagueActive` und pflegt dort ausschliesslich Punkte. Die
Teilnahme-Spalte ist ganz weggefallen: aufgenommen und herausgenommen
wird nur noch im Spieler-Tab (`PlayerRow.tsx`) oder über den Import.
