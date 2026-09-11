# Commander Pairing-Software — Spezifikation

Stand: 2026-08-21 (nach Grill-Session zu Mobile-Optimierung und Gruppen im Casual-Modus)

## 1. Zweck

Web-App zur Organisation von 4-Spieler-Commander-Turnierabenden (Magic: The
Gathering). Kernaufgabe: Spieler fair und regelkonform auf Tische verteilen
("Pairing"), in zwei unterschiedlichen Modi.

## 2. Nutzerkreis & Zugriff

- **Single-User (Organisator)**: eine Person verwaltet Spieler, Abende,
  Pairings und Ergebnisse. Kein Multi-User, keine Rollen/Rechte.
- **Organisator-Navigation**: nach dem Login landet der Organisator auf
  einem Dashboard (`/admin`) mit Links zu den drei Arbeitsbereichen. Die
  Nav ist durchgängig vierteilig: Dashboard, Casual, Liga, Spieler.
- **Zugriffsschutz — passwortloser Email-Login mit Zahlencode**: kein
  Passwort. Der Organisator klickt "Login-Code anfordern" und bekommt einen
  **sechsstelligen Zahlencode** an eine fest konfigurierte Adresse
  (`ADMIN_EMAIL`). Den gibt er in der Eingabemaske ein, die direkt danach
  erscheint. Der Code ist 10 Minuten gültig und nur einmal verwendbar
  (Einlösen markiert ihn in der Datenbank als verbraucht).

  Bewusst ein Code statt eines Links: ein Link öffnet sich je nach
  Mail-Programm im dortigen In-App-Browser, wo das Session-Cookie dann
  landet — und im eigentlichen Browser ist man weiterhin ausgeloggt. Der
  Code wird dagegen in genau dem Browser eingegeben, in dem der Login
  gestartet wurde.

  **Schutz gegen Durchprobieren**: ein sechsstelliger Code hat nur eine
  Million Möglichkeiten, verglichen mit den 256 Bit des früheren Links
  verschwindend wenig. Deshalb sind pro ausgestelltem Code höchstens
  **5 Fehlversuche** erlaubt; danach ist er verbrannt und es braucht einen
  neuen. Jeder Fehlversuch belastet alle offenen Codes, da zu einem falsch
  geratenen Code kein Datensatz existiert, den man belasten könnte.
  Zusätzlich begrenzt das Rate-Limit das Anfordern selbst (max. 5 pro
  10 Minuten).

  Der eigentliche Login-Faktor ist damit "Zugriff auf das Email-Postfach" —
  kein zweiter Faktor im klassischen Sinn, aber ausreichend für eine
  Single-User-Anwendung, sofern das Postfach selbst gut geschützt ist
  (idealerweise mit eigener 2FA).
- **Bestehende Sitzung**: wer `/admin/login` mit gültigem Cookie aufruft,
  wird direkt weitergeleitet — es wird also keine überflüssige Email
  ausgelöst.
- **Sitzungsdauer**: nach dem Login gilt ein signiertes Cookie mit
  **gleitender** Gültigkeit von 7 Tagen. Bei jedem Aufruf im
  Organisator-Bereich wird es frisch ausgestellt (siehe `src/proxy.ts`),
  die Frist läuft also immer ab der letzten Nutzung — ein durchgehend
  genutzter Spielabend kann beliebig lang sein. Die öffentliche
  Lese-Ansicht verlängert nichts, sie ist ja ungeschützt. Ein Abmelden ist
  bewusst nicht vorgesehen; eine Sitzung endet durch Ablauf oder durch
  Löschen der Browserdaten.
- **Öffentliche Lese-Ansicht**: separate URL ohne Login, zeigt nur die
  aktuellen Tischzuteilungen des laufenden Abends (z. B. für einen Bildschirm
  vor Ort oder zum Teilen mit den Spielern). Keine Bearbeitungsmöglichkeit.
- **Hosting — Hybrid**: die App UND die Datenbank (Vercel Postgres)
  laufen auf Vercel (Node.js-fähig) — cyon.ch selbst kann keine dauerhaft
  laufende Node.js-App hosten, und cyons Datenbanken lassen sich nur per
  kontoweitem IP-Whitelisting öffnen (hätte auch andere Projekte auf
  demselben cyon-Konto betroffen). Nur der **Email-Versand (SMTP)** läuft
  weiterhin über das bestehende cyon.ch-Hosting des Auftraggebers (siehe
  DEPLOYMENT.md).
- **Sicherheitshärtung**: Sicherheits-HTTP-Header (siehe `next.config.ts`),
  Rate-Limiting auf den Login-Code-Versand, Prisma-parametrisierte
  Datenbankzugriffe (kein SQL-Injection-Risiko), keine Secrets im
  Client-Bundle. Der Zugriffsschutz auf das Hosting-Konto selbst
  (cyon-Kundencenter-Login, SSH) liegt ausserhalb der App und damit
  ausserhalb dessen, was Code hier absichern kann.

## 3. Tischgrössen-Algorithmus (gemeinsame Basis für beide Modi)

Ziel: aus N anwesenden Spielern eine Aufteilung auf Tische bestimmen.

**Priorität (überarbeitet — 5er-Tische sind absoluter Ausnahmefall):**
1. **5er-Tische nur, wenn eine Aufteilung ausschliesslich mit 3er- und
   4er-Tischen für die gesamte Gruppe mathematisch unmöglich ist.** Da 3 und
   4 teilerfremd sind, lässt sich jede Spielerzahl N ≥ 6 immer als reine
   Kombination aus 3er- und 4er-Tischen darstellen (Frobenius-Zahl von 3
   und 4 ist 5). Ein 5er-Tisch ist demnach **nur bei N = 5 zwingend
   erforderlich** — es gibt keinen anderen Fall, in dem eine reine 3/4-
   Lösung nicht existiert.
2. Innerhalb der gültigen reinen 3er/4er-Kombinationen: so viele 4er-Tische
   wie möglich, Rest mit 3er-Tischen auffüllen (klassisches Prinzip
   "möglichst wenige, möglichst grosse Tische").
3. Gültige Tischgrössen sind grundsätzlich 3, 4, 5 — 5 aber wie oben nur im
   Ausnahmefall N = 5.
4. Der Fall "weniger als 3 Spieler anwesend" tritt laut Auftraggeber in der
   Praxis nicht auf und wird nicht gesondert behandelt (keine
   Fehlerbehandlung nötig, aber die Funktion sollte nicht crashen, falls
   N < 3 versehentlich übergeben wird).

**Beispielverteilungen** (zur Absicherung der Implementierung mit Tests):

| N  | Verteilung        |
|----|--------------------|
| 3  | 1×3               |
| 4  | 1×4               |
| 5  | 1×5 (einziger Fall, in dem ein 5er-Tisch zwingend ist) |
| 6  | 2×3               |
| 7  | 1×3 + 1×4         |
| 8  | 2×4               |
| 9  | 3×3 (nicht 4+5 — 5er wird vermieden) |
| 10 | 1×4 + 2×3 (nicht 2×5) |
| 11 | 1×3 + 2×4         |
| 12 | 3×4               |
| 13 | 1×4 + 1×3 + 1×3 + ... bzw. 3×4 + 1×... → konkret: 1×4+3×3 |
| 14 | 2×4 + 2×3         |

> Tie-Break-Regel innerhalb der reinen 3/4-Lösungen (z. B. bei Zahlen, wo
> mehrere 3/4-Kombinationen möglich sind): **maximale Anzahl 4er-Tische
> gewinnt**, da das automatisch auch die Gesamtzahl der Tische minimiert.

### 3.1 Option "5er-Tisch erlauben" (nur Casual)

Im Casual-Modus lässt sich pro Berechnung **ein einzelner** 5er-Tisch
zulassen (Checkbox neben der Zuteilungsart, siehe Abschnitt 4.2). Dann
wird unter allen Zerlegungen mit höchstens einem 5er die mit den **meisten
4er-Tischen** gewählt.

Betroffen sind genau die Spielerzahlen **N ≡ 1 (mod 4)** — 9, 13, 17,
21, 25, … —, bei denen sonst drei 3er-Tische entstünden:

| N  | Standard      | mit 5er-Tisch |
|----|---------------|---------------|
| 9  | 3+3+3         | **5+4**       |
| 13 | 4+3+3+3       | **5+4+4**     |
| 17 | 4+4+3+3+3     | **5+4+4+4**   |
| 21 | 4+4+4+3+3+3   | **5+4+4+4+4** |

Alle übrigen Spielerzahlen bleiben unverändert — 10 bleibt 4+3+3, 14
bleibt 4+4+3+3.

**Entscheidend ist das Ziel, nicht die Möglichkeit.** "Nimm einen 5er,
wann immer es aufgeht" wäre falsch: bei N = 14 ergäbe das 5+3+3+3 statt
4+4+3+3, also mehr 3er-Tische statt weniger.

**Nicht in der Liga.** Dort hängt an der Tischgrösse die Punktechance —
wer am 5er sitzt, hat statistisch schlechtere Siegchancen als am 4er. Für
einen lockeren Abend ist das egal, für eine Saisonrangliste nicht.

**Die maximale Gruppengrösse bleibt bei 4** (Abschnitt 4.1), auch wenn ein
5er-Tisch erlaubt ist: eine 5er-Gruppe wäre zwingend an genau diesen einen
Tisch gebunden und bei den meisten Spielerzahlen gar nicht platzierbar.

**Gruppen bekommen den knappsten passenden Tisch.** Eine 4er-Gruppe landet
bei den Tischgrössen [5, 4] am 4er und bleibt dort unter sich, statt sich
den 5er mit einem Fremden zu teilen. Nur wenn kein passender Tisch mehr
frei ist, weicht sie auf einen grösseren aus.

## 4. Casual — Rechner + Zuteilung

- **Spielerauswahl** (mobil-optimiert, tap-freundlich):
  - Eine einzige, stabil alphabetisch sortierte Liste aller Vereinsspieler.
    Ein Tap ändert nur den Zustand des Eintrags an seiner Position
    (Häkchen + Hervorhebung) — die Liste springt nie, es gibt bewusst
    **keine** separate "Ausgewählt (n)"-Sektion. Der Auswahlstand steht im
    Zähler der Überschrift "Anwesende Spieler auswählen (n)".
  - Suchfeld filtert die Liste live (Substring-Match auf Vorname+Nachname),
    unabhängig vom Auswahlstatus eines Eintrags — ein ausgewählter Spieler,
    der nicht zum Suchtext passt, wird also ebenfalls ausgefiltert; das
    Leeren des Suchfelds zeigt wieder alle mit ihrem Häkchen.
  - Neuen Spieler anlegen geht auf zwei Wegen: ein fester Button "+ Neuen
    Spieler erfassen" oben an der Liste (öffnet ein kleines Formular:
    Vorname, optional Nachname, optional Skill-Einstufung), oder — wenn
    die Suche 0 Treffer findet — eine Inline-Option "'{Suchtext}' als
    neuen Spieler anlegen" direkt unter dem Suchfeld (Text wird naiv in
    Vorname/Nachname gesplittet). Beide legen den Spieler sofort an und
    wählen ihn automatisch aus. Punktestand startet dabei immer bei 0
    (Liga-Punkte sind für Casual irrelevant).
  - **Enter im Suchfeld** bedient den ganzen Ablauf ohne Maus, weil am
    Spielabend reihum Namen eingetippt werden:
    - genau ein Treffer → dieser Spieler wird ausgewählt und das Suchfeld
      geleert, bereit für den nächsten Namen. Bewusst nur auswählen, nie
      abwählen — sonst nähme ein zweites Enter den eben markierten Spieler
      versehentlich wieder heraus. Im Gruppen-Modus wandert der Spieler
      stattdessen in die entstehende Gruppe, wie bei einem Tap.
    - kein Treffer → das Anlege-Formular öffnet sich vorbefüllt, der
      Fokus steht im Vornamen-Feld. Ein weiteres Enter dort legt den
      Spieler an; danach springt der Fokus zurück ins Suchfeld.
    - mehrere Treffer → nichts, es wäre nicht entscheidbar, wer gemeint
      ist. Der Suchtext bleibt stehen.

    Das jeweilige Enter-Ziel ist sichtbar hervorgehoben — die Kachel des
    einzigen Treffers bzw. der Anlege-Knopf bekommen einen Ring und ein
    kleines ↵. Der Ring legt sich über den bestehenden Zustand der Kachel
    (ausgewählt, Gruppen-Kandidat), statt ihn zu ersetzen; das ↵ sorgt
    dafür, dass die Markierung nicht allein an der Farbe hängt.
- Ausgabe: Tischverteilung (Anzahl & Grösse der Tische) gemäss Algorithmus
  aus Abschnitt 3, plus zufällige Zuteilung der konkreten Spieler auf die
  Tische.
- **Einzelrunde**: keine Mehrrunden-Logik, keine Rematch-Vermeidung.
- **Keine Ergebnis-/Punkteerfassung, kein Verlauf** — rein für lockere
  Spieleabende ohne Bezug zur Liga-Rangliste.
- Organisator kann die Zuteilung manuell anpassen (Spieler zwischen Tischen
  tauschen); die Änderung wird sofort übernommen.
- **Neu auswürfeln**: erneutes "Tische berechnen" ersetzt die Zuteilung.
- **Zurücksetzen**: verwirft die Zuteilung. Die Spielerauswahl bleibt
  bestehen, die öffentliche Ansicht ist danach wieder leer.

### 4.1 Gruppen — Spieler, die garantiert zusammen sitzen

Anwendungsfall: jemand bringt einen Freund mit und will unbedingt mit ihm
am selben Tisch spielen.

- Ein Knopf "+ Gruppe bilden" unterhalb der Spielerliste schaltet einen
  Gruppen-Modus ein. Im Gruppen-Modus fügt ein Tap auf einen Spieler diesen
  der entstehenden Gruppe hinzu; ist er noch nicht als anwesend markiert,
  wird er dabei gleich mit ausgewählt. "Fertig" schliesst die Gruppe (eine
  Gruppe mit weniger als 2 Mitgliedern wird dabei verworfen), "Abbrechen"
  verwirft sie ohne Rückfrage. Kein Long-press — kollidiert mit
  Scrollen/Textauswahl auf dem Handy.
- Gruppenmitglieder tragen ein farbiges Kürzel (A, B, C, …) am
  Listeneintrag. Bestehende Gruppen stehen als kompakte Zeilen mit einem
  × zum Auflösen, plus einem Knopf "alle auflösen".
- **Höchstens 4 Spieler pro Gruppe.** 4 ist die grösste reguläre
  Tischgrösse (Abschnitt 3); ein 5er-Tisch existiert nur bei genau 5
  Anwesenden, wo ohnehin alle zusammensitzen.
- **Harte Regel bei der Zuteilung**: Gruppenmitglieder landen garantiert am
  selben Tisch. Die Tischgrössen-Verteilung aus Abschnitt 3 bleibt dabei
  unangetastet und hat Vorrang — Gruppen müssen sich in sie einfügen, nicht
  umgekehrt. Mehrere Gruppen dürfen sich einen Tisch teilen, wenn sie exakt
  hineinpassen (z. B. zwei Zweier-Gruppen an einem 4er-Tisch) — ohne das
  wären gängige Fälle unlösbar.
- **Machbarkeitsprüfung vor der Berechnung**: ist eine Kombination aus
  Anwesendenzahl und Gruppen unmöglich, erscheint sofort ein konkreter
  Hinweis bei den Gruppen (z. B. "Mit 6 Anwesenden gibt es nur 3er-Tische —
  Gruppe A mit 4 Spielern passt nicht"), und "Tische berechnen" ist
  gesperrt. Kein Fehlschlag erst nach dem Antippen; zusätzlich wird
  serverseitig validiert.
- **Bei der ausgewogenen Zuteilung** (Abschnitt 4.2 unten) zählt eine Gruppe
  als eine Einheit mit dem **Durchschnitts-Skill** ihrer Mitglieder und
  wird damit als Ganzes in die passende Stärke-Region einsortiert.
- **Persistenz**: Anwesenheits-Auswahl, Gruppen, die gewählte Zuteilungsart
  und der 5er-Haken (Abschnitt 4.2) leben zusammen im Browser-Speicher
  (localStorage) des Organisator-Geräts, nicht in der Datenbank — keine
  Migration nötig. Die Zuteilungsart gehört dazu, weil die berechneten
  Tische einen Reload überleben (Abschnitt 4.3): ein selektives
  Neumischen danach soll nicht stillschweigend im falschen Modus laufen. Spieler, die inzwischen archiviert
  oder gelöscht wurden, fallen beim Laden still heraus. "Zurücksetzen"
  (siehe oben) lässt Auswahl und Gruppen unangetastet; aufgelöst werden
  Gruppen nur über die eigenen Knöpfe (× je Gruppe, "alle auflösen").
- In der fertigen Tischzuteilung erscheinen die Gruppen-Kürzel auch an den
  Tischkacheln. Manuelles Tauschen (siehe oben) bleibt uneingeschränkt
  möglich, auch wenn es eine Gruppe trennt — der Organisator ist die letzte
  Instanz. Die Stufen bleiben dabei wie überall unsichtbar.

### 4.2 Zuteilungsart: Zufällig vs. Ausgewogen

Vor der Berechnung wählt der Organisator zwischen zwei Untermodi:

- **Zufällig** (Standard): wie oben beschrieben, keine Berücksichtigung von
  Skill-Level.
- **5er-Tisch erlauben** (Checkbox, unabhängig von der Zuteilungsart —
  beide Kombinationen sind sinnvoll): lässt einen einzelnen 5er-Tisch zu,
  wo er die Verteilung verbessert (Abschnitt 3.1). Ein Hinweis unter der
  Checkbox zeigt für die aktuelle Spielerzahl, was herauskäme, bzw. dass
  sich nichts ändert — sonst wäre nicht erkennbar, ob der Haken überhaupt
  greift. Wirkt wie die Zuteilungsart erst bei der nächsten Berechnung;
  eine bereits stehende Zuteilung bleibt unangetastet.
- **Ausgewogen**: nutzt dieselbe Rang-Gruppierungs-Logik wie
  die Liga (Abschnitt 5.1), aber mit der Skill-Einstufung der Spieler
  (Abschnitt 6) statt Liga-Punkten als Sortier-Kriterium, inkl. Zufalls-
  Rauschen (±1 Skill-Stufe — kleiner als bei der Liga, da die Skala nur
  0-3 umfasst), damit nicht stur die exakt gleich starken Spieler
  zusammen landen.
  - Für noch nicht eingestufte Spieler (Stufe = 0) wird pro Berechnung eine
    zufällige Stufe aus 1-3 gewürfelt. Sie können damit an jedem Tisch
    landen, statt systematisch immer in derselben Region zu erscheinen —
    und bei jeder Neuberechnung fällt es anders aus.
  - Weiterhin keine Persistenz, kein Verlauf, keine Rematch-Vermeidung
    (Casual bleibt Einzelrunde).
  - Die Skill-Werte werden in der Spielerauswahl und in den berechneten
    Tischen bewusst **nicht** angezeigt — sie fliessen nur in die
    Berechnung ein. Wo sie sichtbar sind, steht in Abschnitt 6.1.

### 4.3 Speicherung und öffentliche Anzeige

Die Zuteilung wird gespeichert, aber ausdrücklich **nicht als Verlauf**:

- Es existiert immer nur **die eine aktuelle** Zuteilung (`CasualSeat`).
  Neu berechnen ersetzt sie vollständig, Zurücksetzen löscht sie.
- Sie liegt bewusst in einer eigenen Tabelle, getrennt von den
  Liga-Abenden (`Evening`/`Round`/`Table`). Dadurch zählt sie **nicht** als
  Abend-Teilnahme und blockiert nie das harte Löschen eines Spielers
  (Abschnitt 6.2). Wird ein Spieler gelöscht, verschwindet sein Platz per
  Cascade mit.
- Gespeichert wird in erster Linie, damit die öffentliche Lese-Ansicht die
  Tische zeigen kann — ohne das sähe sie niemand ausser dem Organisator.
- Ein Spieler, der zwischenzeitlich archiviert wurde, behält seinen Platz
  in einer bestehenden Zuteilung und lässt sich weiterhin tauschen und
  neu mischen — beim Neumischen wird nicht entschieden, wer anwesend ist,
  sondern nur die bestehende Belegung umgestellt. In die Auswahlliste für
  eine **neue** Berechnung kommt er nicht mehr.
- Die Admin-Seite liest die gespeicherte Zuteilung beim Laden ebenfalls und
  zeigt sie als Startzustand an. Ein Reload verschluckt sie dadurch nicht
  mehr. Das gilt nur für Zuteilungen, die **jünger als 24 Stunden** sind —
  was älter ist, gehört zu einem vergangenen Abend und wird dem
  Organisator nicht als aktueller Stand untergeschoben. Die Frist betrifft
  ausschliesslich diese Auto-Anzeige: die Zeilen bleiben stehen und die
  öffentliche Seite zeigt sie unbegrenzt weiter, bis zurückgesetzt wird.
- Öffentlich wird immer nur **eines von beidem** gezeigt: existiert eine
  Casual-Zuteilung, hat sie Vorrang; sonst der laufende Liga-Abend. Das
  Starten eines Liga-Abends verwirft eine offene Casual-Zuteilung, damit
  die Regel nicht aufweichen kann.

## 5. Liga — Rangliste-Pairing

- Kontext: bestehende Saison-Liga mit Achievement-basiertem Punktesystem
  (siehe https://mtgbl.ch/liga/commander/2026/achievements — 25
  Achievements pro Abend, u. a. Teilnahme, Sieg, erste Eliminierung,
  Deckbau- und rotierende Achievements). Die App bildet **nicht** das
  komplette Achievement-Sheet ab — der Organisator hält während des Abends
  nur fest, wer seinen Tisch gewonnen hat (siehe unten).
- **Ablauf pro Abend:**
  1. Anwesende Spieler aus den Liga-teilnehmenden Vereinsspielern auswählen
     (siehe Abschnitt 6 — nicht jeder Vereinsspieler nimmt an der Liga teil).
  2. **Runde 1**: Sortierung nach aktuellem Gesamt-Liga-Punktestand
     (Stand vor diesem Abend). Tischverteilung gemäss Algorithmus aus
     Abschnitt 3, Spieler in Punktereihenfolge auf die Tische verteilt
     (übliche Pairing-Logik: nach Rang gruppieren/verteilen, siehe Abschnitt
     5.1 für Detailregel).
  3. Sobald ein Tisch fertig ist, hält der Organisator fest, **wie er
     ausgegangen ist**: Sieger antippen, oder "Unentschieden", wenn das
     Zeitlimit von 120 Minuten erreicht wurde (Liga-Regeln auf mtgbl.ch).
     Nochmals dieselbe Auswahl antippen macht die Erfassung rückgängig.
     Erst wenn für **jeden** Tisch eines von beidem feststeht, lässt sich
     Runde 2 starten oder der Abend beenden.
  4. **Runde 2**: Sortierung nach dem **Sieg aus Runde 1** — die Gewinner
     spielen gegeneinander. Danach dieselbe Rang-Gruppierung wie in Runde 1
     (Abschnitt 5.1), inklusive weicher Rematch-Vermeidung (Abschnitt 5.2).
  5. **Genau zwei Runden pro Abend** ("Pro Liga-Abend werden zwei Spiele
     gespielt", mtgbl.ch). Danach wird der Abend beendet.

**Warum der Sieg und nicht die Punktsumme?** Zwei Gründe. Die Punktsumme
existiert zum Zeitpunkt der Paarung nicht — die Achievement-Zettel werden
erst am Ende des Abends abgegeben. Und sie würde das Falsche messen: ein
grosser Teil der Punkte steht vor der ersten Karte fest (Pauper +4,
Evergreen +7, No Sol Ring +1 ergeben +12 ohne gespielte Partie), während
ein gewonnenes Match +1 bringt. Eine Sortierung nach Punktsumme setzte die
Spieler nach ihrer Deckwahl an die Tische statt nach dem Verlauf der Runde.

**Unentschieden**: Alle an einem solchen Tisch zählen als ohne Sieg — das
deckt sich mit der Wertung, denn "Winner winner – chicken dinner" gibt es
nur für einen gewonnenen Match. Gehen *alle* Tische unentschieden aus, ist
der Sortierschlüssel für jeden gleich und Runde 2 wird schlicht wieder
zufällig.

**Keine Punkteerfassung pro Runde.** Die App führt den Punktestand eines
Abends nicht mehr fort; `Player.points` ist die über den Import gepflegte
Kopie des Saisonstands von mtgbl.ch und dient allein der Paarung von
Runde 1. Die Achievement-Punkte werden am Abendende erfasst (siehe
BACKLOG.md) und wandern von dort nach mtgbl.ch.

- **Kein separates "Abend verwerfen"**: "Abend beenden" verlangt keine
  vollständigen Ergebnisse (mehr) — ein versehentlich gestarteter Abend
  lässt sich also jederzeit direkt beenden, ohne dass es dafür einen
  eigenen Lösch-Weg braucht. Die Historie bleibt dabei stehen (siehe
  "Keine Punkteerfassung pro Runde" oben — sie wird ohnehin nicht
  ausgewertet).
- **Tie-Break bei Punktegleichstand**: zufällige Reihenfolge.
- **Rematch-Vermeidung**: weiches Kriterium, gilt nur **innerhalb desselben
  Abends** (nicht saisonübergreifend). Priorität bleibt die
  Tischgrössenverteilung aus Abschnitt 3 — Rematch-Vermeidung darf diese
  nicht verletzen, wird also nur angewendet, wenn mehrere Zuteilungen mit
  gleicher Tischgrössen-Verteilung möglich sind.
- Organisator kann jede vorgeschlagene Zuteilung manuell anpassen (Spieler
  zwischen Tischen tauschen).

### 5.1 Sortier-/Gruppierungsregel für die Tischzuteilung

Gerechnet wird in **Rängen**, nicht in Punkten. Tische sind das Ergebnis
der Sortierung, keine Eingabegrösse.

**Die Rangfolge entsteht aus Punkten pro besuchtem Abend, nicht aus der
Gesamtsumme** (`src/lib/pairing/leagueRanking.ts`). Die Gesamtsumme misst
zu einem guten Teil Anwesenheit statt Stärke: im Stand nach drei Abenden
2026 stand David mit 11 Punkten auf Platz 23 von 28 — aus einem einzigen
Abend, an dem er mehr geholt hat als die Hälfte des Feldes im Schnitt.
Nach Gesamtpunkten zu paaren hätte ihn an den letzten Tisch gesetzt, und
weil dieselben Leute regelmässig fehlen, säßen unten jeden Abend
dieselben zusammen. Die offizielle Wertung auf mtgbl.ch bleibt davon
unberührt — dort zählt weiterhin die Gesamtsumme.

Der Schnitt wird **gedämpft**: jedem Spieler werden `DAEMPFUNG_ABENDE`
(2) fiktive Abende zum Ligadurchschnitt gutgeschrieben. Ein einzelner
guter Abend hebt damit niemanden weit nach oben — bei einer einzigen
Messung ist der Schnitt schlicht nicht belastbar. Die Anzahl besuchter
Abende stammt aus den Rundenspalten der importierten Rangliste
(Abschnitt 7).

Auf den so gewonnenen Rangplatz kommen zwei Zuschläge:

- **Zufalls-Rauschen `RANG_RAUSCHEN` (±10 Ränge).** Der Regler gegen
  "immer dieselben Gegner". Gemessen über eine Saison mit 28 Spielern:
  ohne Rauschen sitzt man mit seinem häufigsten Gegner 9 von 12
  Zuteilungen zusammen, bei ±10 nur noch 4,5, und man trifft 17,9 statt
  12,8 verschiedene Leute.
- **Sieg-Bonus `SIEG_BONUS_RAENGE` (3 Ränge)** in Runde 2 für alle, die
  ihren Tisch in Runde 1 gewonnen haben (Abschnitt 5). Bewusst endlich:
  ein Sieg soll heben, aber nicht an die Spitze katapultieren. Wer an
  einem hinteren Tisch gewinnt, trifft auf die Sieger seiner Umgebung.

Danach werden die Spieler gemäss der berechneten Tischgrössen
(Abschnitt 3) in aufeinanderfolgende Blöcke eingeteilt.

**Es gibt bewusst keine harte Obergrenze** für den Rangabstand an einem
Tisch: die Sortierung selbst begrenzt, wer zusammenkommen kann. Der Preis
des grosszügigen Rauschens sind rund fünf Tische pro Saison, an denen
jemand aus dem obersten Viertel mit jemandem aus dem untersten sitzt —
gegen den Gewinn an Abwechslung abgewogen und angenommen.

Der Organisator kann eine Runde ausserdem jederzeit (solange noch keine
Ergebnisse für sie eingetragen wurden) neu auswürfeln lassen ("Neu
mischen"-Button), falls ihm der erste Vorschlag nicht zusagt.

### 5.2 Rematch-Vermeidung — Umsetzung

Bei der Neupaarung für Runde 2/3 wird, wenn mehrere Spieler mit
(näherungsweise) gleichem Punktestand für die Randposition eines
Tisch-Blocks infrage kommen, derjenige bevorzugt, der in der/den
vorherigen Runde(n) dieses Abends noch nicht mit den anderen Spielern des
Ziel-Tisches zusammen gespielt hat. Die Tischgrössenverteilung selbst
(Abschnitt 3) bleibt davon unberührt.

## 6. Spielerverwaltung

Nicht jeder Vereinsspieler nimmt an der Liga teil — deshalb ist die
Verwaltung auf zwei Tabs aufgeteilt:

- **Spieler-Tab** (zentrales Vereins-Roster):
  - Persistente Spielerdatenbank: Spieler anlegen (Vorname, optional
    Nachname, Stufe, optional direkt als Liga-Teilnehmer).
  - Enthält je Spieler eine optionale **Skill-Einstufung** auf der Skala
    0-3, im Organisator-UI schlicht als "Stufe" bezeichnet (siehe
    `src/lib/players.ts`). Die Stufen werden bewusst **ohne Beschriftung**
    angeboten — die Dropdowns zeigen nur die nackte Zahl. 0 bedeutet "noch
    nicht eingestuft" und wird bei der Zuteilung zufällig behandelt
    (Abschnitt 4.2).

    Komplett unabhängig vom Liga-Punktestand, wird ausschliesslich für die
    ausgewogene Zuteilung im Casual-Modus verwendet (Abschnitt 4.2).
  - Zeigt und ändert die **Liga-Teilnahme** (`leagueActive`) pro Spieler.
  - Zeigt **keine** Liga-Punkte — die werden im Liga-Tab gepflegt.

### 6.1 Sichtbarkeit der Stufen-Einstufung

Die Stufen sollen die Spieler nicht mitbekommen. Sie erscheinen deshalb
nur dort, wo sie aktiv gepflegt werden:

- **sichtbar**: in den beiden Anlege-Formularen (Spieler-Tab und die
  Inline-Anlage im Casual-Tab) sowie als editierbare Spalte im Spieler-Tab.
- **nicht sichtbar**: in der Casual-Spielersuche, bei den ausgewählten
  Spielern und in den fertigen Tischzuteilungen — also überall dort, wo
  jemand beim Spielabend mitlesen könnte. Die öffentliche Lese-Ansicht
  (Abschnitt 8) zeigt ohnehin nie Stufen.

### 6.2 Spieler entfernen

Über den Spieler-Tab lässt sich jeder Spieler entfernen. Was dabei
passiert, hängt von seiner Historie ab:

- **ohne Abend-Historie**: der Spieler wird endgültig aus der Datenbank
  gelöscht.
- **mit Abend-Historie**: der Spieler wird **archiviert** (`archivedAt`
  wird gesetzt) statt gelöscht. Er verschwindet aus allen Listen, seine
  Tischzuteilungen und Rundenergebnisse bleiben aber erhalten, damit
  vergangene Abende nachvollziehbar bleiben (Abschnitt 8). Es gibt bewusst
  keine Archiv-Ansicht — ein Wiederherstellen wäre nur über direkten
  Datenbankzugriff möglich.
- **während eines laufenden Liga-Abends**: ist der Spieler einem Tisch des
  laufenden Abends zugeteilt, ist das Entfernen gesperrt — sonst würde die
  Zuteilung des laufenden Abends zerreissen.

Beide Fälle werden über denselben Bestätigungsdialog abgefragt.

### 6.3 Liga-Tab (siehe Abschnitt 5)

- Enthält je Spieler den aktuellen Gesamt-Liga-Punktestand (Kopie des
  Standes von mtgbl.ch, gepflegt über den Import aus Abschnitt 7, hier
  aber auch manuell editierbar) sowie — wie der Spieler-Tab — die
  **Liga-Teilnahme-Flag**. Dazu die Anzahl besuchter Abende, die aus
  denselben Importdaten stammt und in die Paarung eingeht
  (Abschnitt 5.1).
- Die Teilnahme-Flag wirkt rein zukunftsgerichtet: sie filtert nur die
  Auswahlliste beim Start eines neuen Liga-Abends — bestehende Abende und
  Ergebnisse bleiben beim Deaktivieren unberührt.
- Neu angelegte Spieler starten mit `leagueActive = false`, sofern beim
  Anlegen nichts anderes angehakt wurde. Der Text-Import der
  Saison-Rangliste (Abschnitt 7) markiert importierte Spieler automatisch
  als Liga-teilnehmend.
- Es gibt kein Saison-Konzept: zum Saisonwechsel werden Teilnahmen manuell
  umgestellt.

### 6.4 Auto-Save

Alle Felder speichern automatisch — Auswahlfelder und Checkboxen sofort bei
Änderung, Textfelder beim Verlassen des Feldes (Blur). Kein expliziter
"Speichern"-Klick nötig, kurzes visuelles Feedback ("✓ Gespeichert")
bestätigt den Vorgang. Gilt für beide Tabs.

## 7. Datenimport zu Beginn

- Die aktuelle Saison-Rangliste liegt auf mtgbl.ch. Der Organisator
  kopiert die Tabelle als Text in den Import-Dialog des Liga-Tabs — kein
  automatisiertes Scraping. Erkannt werden die Spalten **Spieler** und
  **Total** anhand des Tabellenkopfs (nicht anhand der Position) sowie
  die **Rundenspalten** `R1`, `R2`, … :

  ```
  | # | Spieler | F | Total | R1 | R2 | R3 |
  ```

- Aus den Rundenspalten wird gezählt, an wie vielen Abenden ein Spieler
  teilgenommen hat: jede Zelle mit einer Zahl ist ein besuchter Abend,
  ein Strich oder eine leere Zelle nicht. Diese Zahl geht in die
  Rangfolge für die Paarung ein (Abschnitt 5.1) — ohne sie würde die
  App nach Gesamtpunkten sortieren und damit nach Anwesenheit statt nach
  Stärke.
- Der Import ist **kein Aufaddieren**: er setzt Punktestand und
  Abendzahl auf die importierten Werte und markiert die Spieler als
  liga-teilnehmend. Er kann vor jedem Abend wiederholt werden.

## 8. Verlauf / Historie

- Vergangene Abende (Datum, Modus, Tischzuteilungen je Runde, eingetragene
  Ergebnisse) werden dauerhaft gespeichert.
- Zweck: Nachvollziehbarkeit der Saison, Basis für Statistiken. Wird
  **nicht** für saisonübergreifende Rematch-Vermeidung genutzt (siehe 5.2 —
  nur innerhalb desselben Abends).

## 9. Ausdrücklich ausserhalb des Scopes (v1)

- Kein Multi-User/Rollenmodell.
- Keine Digitalisierung des vollständigen Achievement-Sheets (25 Punkte pro
  Abend einzeln) — nur Gesamtsumme pro Spieler/Runde.
- Kein automatischer Import/Sync mit mtgbl.ch.
- Keine saisonübergreifende Rematch-Vermeidung.
- Keine Sonderbehandlung für „zu wenige Spieler" (< 3 anwesend) — tritt
  laut Auftraggeber nicht auf.
- Casual speichert keine Ergebnisse/Punkte und keinen Verlauf — nur die
  eine aktuelle Zuteilung für die öffentliche Anzeige (Abschnitt 4.3).

## 10. Offene technische Fragen (vor Deployment zu klären)

- Umgesetzt als Hybrid-Deployment (App + Datenbank auf Vercel, nur Email
  über cyon.ch), siehe [DEPLOYMENT.md](./DEPLOYMENT.md). Ursprünglich war
  die Datenbank ebenfalls bei cyon geplant, das scheiterte aber am
  kontoweiten IP-Whitelisting für externen DB-Zugriff (hätte auch andere
  cyon-Projekte des Auftraggebers betroffen) — Vercel Postgres braucht
  kein IP-Whitelisting und ist direkt im selben Dashboard eingerichtet.
- Lokale Entwicklung läuft gegen ein PostgreSQL in Docker
  (`docker-compose.yml`), identisch zur Produktions-Datenbank-Engine.
- Eigene Domain (statt `*.vercel.app`) ist optional und kann jederzeit
  nachträglich in Vercel eingerichtet werden.
