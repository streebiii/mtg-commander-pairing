# Commander Pairing-Software — Spezifikation

Stand: 2026-10-13 (Ligaverwaltung, Begriffe Runde/Match, Liga wie Casual aufgebaut, Paarung aus eigener Rangliste statt Import, Spieler-Tab als Tabelle, Erfassung in Schritten, Schrift mindestens 16px)

## 1. Zweck

Web-App zur Organisation von 4-Spieler-Commander-Turnierabenden (Magic: The
Gathering). Kernaufgabe: Spieler fair und regelkonform auf Tische verteilen
("Pairing"), in zwei unterschiedlichen Modi.

## 2. Nutzerkreis & Zugriff

- **Single-User (Organisator)**: eine Person verwaltet Spieler, Abende,
  Pairings und Ergebnisse. Kein Multi-User, keine Rollen/Rechte.
- **Begriffe**: ein Liga-Abend heisst **Runde** (R1–R6, in der Saison
  sechs), die zwei Paarungen darin **Match 1** und **Match 2**. Im Code
  heisst die Runde weiterhin `Evening`, das Match `Round`.
- **Organisator-Navigation**: Dashboard · Casual · Liga · Ligaverwaltung ·
  Spieler. Nach dem Login landet der Organisator auf dem **Dashboard**
  (`/admin`), einer Übersicht dessen, was gerade los ist: laufende Runde
  mit Match-Stand (sonst die Zahl aktiver rotierender Achievements, mit
  Warnung, wenn es nicht 10 sind), Stand der Achievement-Erfassung,
  Casual-Zuteilung und Links zur öffentlichen Ansicht und Rangliste —
  jeweils mit Link dorthin, wo man es bearbeitet. «Liga» ist der
  Spielabend (Abschnitt 5), die **Ligaverwaltung** alles darum herum
  (Abschnitt 14).
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
- **Namen öffentlich nur gekürzt**: Rangliste, Pairings, Tischseite und
  Erfassungsblatt zeigen Vorname und Initial wie auf mtgbl.ch («David
  L.»). Teilen sich zwei Spieler Vorname und Initial, kommen so viele
  Buchstaben dazu wie nötig («Marc St.», «Marc So.»), verglichen gegen
  alle Spieler, damit jeder überall gleich heisst (`publicNames` in
  `src/lib/players.ts`). Den vollen Namen sieht nur der Organisator.
- **Öffentliche Lese-Ansicht**: separate URL ohne Login, zeigt nur die
  live geschalteten Tischzuteilungen des laufenden Abends (z. B. für einen
  Bildschirm vor Ort oder zum Teilen mit den Spielern). Keine
  Bearbeitungsmöglichkeit. Daneben, ebenfalls ohne Login, die Rangliste
  der Saison unter `/rangliste` (Abschnitt 13); eine Umschaltung
  „Pairings | Rangliste“ verbindet die beiden.
- **Hosting — Hybrid**: die App UND die Datenbank (Vercel Postgres)
  laufen auf Vercel (Node.js-fähig) — cyon.ch selbst kann keine dauerhaft
  laufende Node.js-App hosten, und cyons Datenbanken lassen sich nur per
  kontoweitem IP-Whitelisting öffnen (hätte auch andere Projekte auf
  demselben cyon-Konto betroffen). Nur der **Email-Versand (SMTP)** läuft
  weiterhin über das bestehende cyon.ch-Hosting des Auftraggebers (siehe
  DEPLOYMENT.md).
- **Schriftgrösse**: in der ganzen App kein Text unter 16px (`text-base`),
  auch nicht für Hinweise und Tabellen. Seitentitel `text-xl`,
  Abschnittstitel `text-lg`. Eingabefelder ohnehin mindestens 16px
  (iOS-Zoom, siehe `globals.css`).
- **Sicherheitshärtung**: Sicherheits-HTTP-Header (siehe `next.config.ts`),
  Rate-Limiting auf den Login-Code-Versand, Login-Prüfung in **jeder**
  Organisator-Server-Action (`requireAdmin`, `src/lib/adminGuard.ts`) —
  der Proxy schützt nur die Seiten unter `/admin`, Server Actions lassen
  sich aber auch über andere Pfade auslösen —, Prisma-parametrisierte
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
| 13 | 1×4 + 3×3         |
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
- **Warteraum wie in der Liga**: eine berechnete Zuteilung sieht zuerst nur
  der Organisator. Erst **"Live schalten"** macht sie öffentlich
  (Abschnitt 4.3).
- Organisator kann die Zuteilung manuell anpassen (Spieler zwischen Tischen
  tauschen, einzelne Tische neu mischen) — im Warteraum wie nach dem Live
  schalten. Ist sie schon live, sieht die öffentliche Seite die Änderung
  sofort.
- **Neu auswürfeln**: erneutes "Tische berechnen" ersetzt die Zuteilung;
  die neue landet wieder im Warteraum.
- **Zurücksetzen**: verwirft die Zuteilung. Die Spielerauswahl bleibt
  bestehen, die öffentliche Ansicht ist danach wieder leer.
- Die Spielerauswahl (Liste, Suche, Enter-Kette) ist dieselbe wie beim
  Start eines Liga-Abends (`src/components/PlayerPicker.tsx`); nur Casual
  kann dabei neue Spieler anlegen.

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
- **Ausgewogen**: sortiert nach der Skill-Einstufung (Abschnitt 6) mit
  Zufalls-Rauschen (±1 Stufe, die Skala umfasst nur 0-3) und teilt die
  Reihe in aufeinanderfolgende Blöcke — ähnlich starke Spieler sitzen
  zusammen, ohne dass stur immer dieselben am selben Tisch landen
  (`src/lib/pairing/rankGrouping.ts`).

  **Bewusst eine andere Logik als die Liga.** Die Liga teilt in zwei
  Hälften und verteilt darin zufällig (Abschnitt 5.1), weil sich dort mit
  Rang-Blöcken die Stärksten immer wieder am selben Tisch fanden. Casual
  will genau das Gegenteil: ausgeglichene Partien innerhalb eines Tisches,
  an einem einzelnen Abend ohne Saisonrangliste.
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
- **Warteraum**: eine neu berechnete Zuteilung ist zunächst nicht
  öffentlich (`CasualSeat.publishedAt` leer). "Live schalten" setzt den
  Zeitpunkt; Tauschen und Neumischen einzelner Tische lassen ihn stehen.
- Sie liegt bewusst in einer eigenen Tabelle, getrennt von den
  Liga-Abenden (`Evening`/`Round`/`Table`). Dadurch zählt sie **nicht** als
  Abend-Teilnahme und blockiert nie das harte Löschen eines Spielers
  (Abschnitt 6.2). Wird ein Spieler gelöscht, verschwindet sein Platz per
  Cascade mit.
- Gespeichert wird in erster Linie, damit die öffentliche Lese-Ansicht die
  Tische zeigen kann.
- Ein Spieler, der zwischenzeitlich archiviert wurde, behält seinen Platz
  in einer bestehenden Zuteilung und lässt sich weiterhin tauschen und
  neu mischen — beim Neumischen wird nicht entschieden, wer anwesend ist,
  sondern nur die bestehende Belegung umgestellt. In die Auswahlliste für
  eine **neue** Berechnung kommt er nicht mehr.
- Die Admin-Seite liest die gespeicherte Zuteilung beim Laden ebenfalls und
  zeigt sie als Startzustand an — ein Reload verschluckt sie nicht.
- **Nach 24 Stunden gilt eine Zuteilung als abgelaufen**, für den
  Organisator wie für die öffentliche Seite: sie gehört dann zu einem
  vergangenen Abend. Früher galt die Frist nur im Admin-Bereich; öffentlich
  hing eine alte Zuteilung dann weiter, ohne dass der Organisator sie noch
  sah und zurücksetzen konnte.
- Öffentlich wird immer nur **eines von beidem** gezeigt: existiert eine
  live geschaltete Casual-Zuteilung, hat sie Vorrang; sonst der laufende
  Liga-Abend. Casual- und Liga-Abende finden nie gleichzeitig statt; das
  Starten eines Liga-Abends verwirft eine offene Casual-Zuteilung trotzdem,
  damit die Regel nicht aufweichen kann.

## 5. Liga — Rangliste-Pairing

- Kontext: bestehende Saison-Liga mit Achievement-basiertem Punktesystem
  (siehe https://mtgbl.ch/liga/commander/2026/achievements — 25
  Achievements pro Abend, u. a. Teilnahme, Sieg, erste Eliminierung,
  Deckbau- und rotierende Achievements). Für die **Paarung** zählt davon
  nur, wer seinen Tisch gewonnen hat — das hält der Organisator während
  des Abends fest (siehe unten). Die Achievements selbst erfassen die
  Spieler (Abschnitt 12).
- **Ablauf pro Abend:**
  1. Anwesende Spieler aus den Liga-teilnehmenden Vereinsspielern auswählen
     (siehe Abschnitt 6 — nicht jeder Vereinsspieler nimmt an der Liga teil).
  2. **Match 1**: Sortierung nach der eigenen Rangliste der Saison
     (Abschnitt 13, Stand vor diesem Abend). Tischverteilung gemäss Algorithmus aus
     Abschnitt 3, Spieler in Punktereihenfolge auf die Tische verteilt
     (übliche Pairing-Logik: nach Rang gruppieren/verteilen, siehe Abschnitt
     5.1 für Detailregel).
  3. Sobald ein Tisch fertig ist, hält der Organisator fest, **wie er
     ausgegangen ist**: Sieger antippen, oder "Unentschieden", wenn das
     Zeitlimit von 120 Minuten erreicht wurde (Liga-Regeln auf mtgbl.ch).
     Nochmals dieselbe Auswahl antippen macht die Erfassung rückgängig.
     Erst wenn für **jeden** Tisch eines von beidem feststeht, lässt sich
     Match 2 starten oder der Abend beenden.
  4. **Match 2**: dieselbe Rangfolge und Hälften-Teilung wie in Match 1
     (Abschnitt 5.1), wobei die Sieger aus Match 1 um 4 Ränge nach oben
     rücken. Innerhalb jeder Hälfte spielen die **Gewinner garantiert
     gegeneinander** (Abschnitt 5.2), die übrigen Plätze werden zufällig
     besetzt, mit weicher Rematch-Vermeidung.
  5. **Genau zwei Matches pro Runde** ("Pro Liga-Abend werden zwei Spiele
     gespielt", mtgbl.ch). Danach wird die Runde beendet.

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
der Sortierschlüssel für jeden gleich und Match 2 wird schlicht wieder
zufällig.

**Keine Punkteerfassung pro Runde.** Die App führt den Punktestand eines
Abends nicht während des Abends fort. Die Achievement-Punkte erfassen die
Spieler (Abschnitt 12); mit dem Schliessen der Erfassung zählen sie in der
Rangliste (Abschnitt 13) und damit für die Paarung von Match 1 am nächsten
Abend. Nach mtgbl.ch werden sie von Hand übertragen.

**Aufbau des Liga-Tabs — wie Casual.** Beide starten ein Spiel und sind
deshalb gleich aufgebaut: Überschrift mit Info-Knopf, links der Inhalt
(vor dem Start die Spielerauswahl, danach die Runden mit der aktuellen
zuoberst und «Live schalten» neben ihrer Überschrift), rechts die
Seitenleiste mit Einstellungen und Aktionen («Abend starten» bzw. «Neu
mischen», «Nächste Runde starten», «Abend beenden», Anwesenheit und der
Stand der Achievement-Erfassung). Gemeinsame Bausteine:
`src/components/InfoHeading.tsx`, `src/components/Sidebar.tsx`.

- **Kein separates "Abend verwerfen"**: "Abend beenden" verlangt keine
  vollständigen Ergebnisse (mehr) — ein versehentlich gestarteter Abend
  lässt sich also jederzeit direkt beenden, ohne dass es dafür einen
  eigenen Lösch-Weg braucht. Die Historie bleibt dabei stehen (siehe
  "Keine Punkteerfassung pro Runde" oben — sie wird ohnehin nicht
  ausgewertet).
- **"Abend beenden" fragt nach.** Es lässt sich nicht rückgängig machen,
  und der Knopf steht direkt neben "Nächste Runde starten". Ist Match 2
  noch nicht live, warnt die Rückfrage ausdrücklich davor. Ein Fehltipp
  nach Match 1 hätte sonst den Abend gekostet: ein neu gestarteter Abend
  schliesst die offene Achievement-Erfassung des alten (Abschnitt 12.3).
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
der Zuteilung, keine Eingabegrösse.

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
Messung ist der Schnitt schlicht nicht belastbar. Punkte und besuchte
Abende stammen aus der eigenen Rangliste (`loadPairingStandings` in
`src/lib/rankingData.ts`): die Summe aller geschlossenen Abende der Saison
— bewusst ohne Streichresultat — und die Zahl der Abende mit Punkten. Der
laufende Abend zählt nicht mit. Bis zum 13.10.2026 kamen beide Werte aus
einem Text-Import der Rangliste von mtgbl.ch (`Player.points`,
`Player.attendedEvenings`); die Felder sind seither unbenutzt.

In Match 2 kommt ein **Sieg-Bonus `SIEG_BONUS_RAENGE` (4 Ränge)** dazu,
für alle, die ihren Tisch in Match 1 gewonnen haben. Er wirkt sich vor
allem an der Grenze zwischen oberer und unterer Hälfte aus (siehe
unten) — er entscheidet, ob ein Sieg knapp an der Grenze liegende
Spieler in die stärkere Hälfte hebt. Weiter innerhalb einer Hälfte
spielt der genaue Rang keine Rolle mehr.

**Zuteilung — Hälften statt Rang-Blöcke.** Die sortierten Spieler werden
in eine obere (stärkere) und eine untere (schwächere) Hälfte geteilt —
die schwächere Hälfte spielt nie gegen die stärkere. Innerhalb jeder
Hälfte werden die Tische **komplett zufällig** besetzt, ganz ohne
weiteren Rang-Bezug.

Das ersetzt ein früheres Modell mit durchgehendem Zufalls-Rauschen auf
eine einzige, fortlaufende Rangliste. Eine Simulation zeigte: selbst mit
grosszügigem Rauschen häufen sich die besten Ränge weiterhin extrem
stark an einem einzigen Tisch (>80% Chance, dass mindestens 3 der besten
5 zusammensitzen) — ein struktureller Effekt der Rang-Block-Paarung an
den Rändern der Liste, kein Tuning-Problem (siehe BACKLOG.md). Die
Hälften-Teilung mit vollständig zufälliger Verteilung darin senkt diesen
Wert auf unter ein Viertel, bei exakt gleicher Sicherheit gegen extreme
Fehlpaarungen (oberstes Viertel trifft nie das unterste).

**Wo genau die Grenze liegt**, entscheidet in erster Linie die
Tischgrössen-Regel (Abschnitt 3): gewählt wird die Aufteilung, die
insgesamt die wenigsten Nicht-4er-Tische ergibt — geht die Gesamtzahl der
Anwesenden rechnerisch komplett in 4er-Tische auf (z.B. 28 Spieler →
7×4), darf die Halbierung selbst keine unnötigen 3er-Tische erzeugen
(eine exakte Hälfte von 14/14 ergäbe sonst pro Seite `[4,4,3,3]` statt
der mit 12/16 möglichen reinen 4er-Aufteilung).

**Kein 5er-Tisch.** Eine Hälfte mit genau 5 Spielern ergäbe einen
5er-Tisch; solche Grenzen sind ausgeschlossen (Vereinsregel 4 > 3 > 5).
Ohne diese Regel zählte ein 5er als nur ein Nicht-4er-Tisch und schlug
damit drei 3er — bei 13 Anwesenden kam so 4+4+5 statt 4+3+3+3 heraus. Ab
6 Anwesenden gibt es immer eine Grenze ohne 5er.

**Ein unvermeidbarer Nicht-4er-Tisch landet bevorzugt in der unteren
(schwächeren) Hälfte.** Ergeben zwei Aufteilungen dieselbe Gesamtzahl an
Nicht-4er-Tischen (z.B. bei 11 Anwesenden sowohl Grenze 4 als auch
Grenze 7), aber nur eine davon lässt ihn in der oberen Hälfte
entstehen, gewinnt die andere — die Spitze soll nicht öfter als nötig
an einem kleineren Tisch sitzen.

Erst danach zählt die Nähe zur exakten Mitte. Gibt es mehrere
gleichwertige Aufteilungen (wie 12/16 und 16/12 bei 28 Anwesenden), wird
zufällig eine davon gewählt — das sorgt nebenbei dafür, dass zwei fast
gleich starke Spieler direkt an der Grenze sich nicht künstlich nie
begegnen, ohne die Sicherheit an den Extremen zu gefährden.

Der Organisator kann eine Runde ausserdem jederzeit (solange noch keine
Ergebnisse für sie eingetragen wurden) neu auswürfeln lassen ("Neu
mischen"-Button), falls ihm der erste Vorschlag nicht zusagt.

### 5.2 Sieger zusammen, dann lokale Verbesserung

**Sieger spielen gegeneinander — innerhalb ihrer Hälfte, als feste
Regel** (Entscheid des Organisators vom 13.10.2026). In Match 2 werden in
jeder Hälfte zuerst die Sieger aus Match 1 gemeinsam an die grössten
Tische gesetzt (4er vor 3er), danach die übrigen zufällig auf die
restlichen Plätze. Sind es mehr Sieger, als an einen Tisch passen (z. B.
5 in einer Hälfte, weil der Sieg-Bonus zwei von unten hochgehoben hat),
entsteht ein reiner Siegertisch und der Rest sitzt zusammen am nächsten.
Ein Sieger aus der unteren Hälfte, den der Bonus über die Grenze hebt,
spielt mit den Siegern der oberen Hälfte. Bis dahin war das Zusammensetzen
nur ein schwach gewichtetes Kriterium des Tausch-Optimierers (in der
Simulation trotzdem in 97–100 % der Fälle erfüllt).

Unter den Siegern gibt es nie ein Rematch — sie sassen in Match 1 alle an
verschiedenen Tischen. Die feste Regel kostet deshalb keine
Rematch-Vermeidung; gemessen bleiben die Rematches gleich.

Danach versucht ein Tausch-Optimierer, zwei weiche Kriterien zu
verbessern — nie über die Hälften-Grenze hinweg, nie auf Kosten der
Tischgrössenverteilung (Abschnitt 3) und **ohne einen Sieger zu
bewegen**:

1. **Rematch-Vermeidung** (am stärksten gewichtet): ein Tausch wird
   bevorzugt, wenn er eine Wiederholungsbegegnung (Rematch) aus einer
   vorherigen Runde dieses Abends auflöst.
2. **Wiederholte Nicht-4er-Zuteilung vermeiden**: wer an diesem Abend
   schon einmal an einem Nicht-4er-Tisch (i.d.R. ein 3er) sass, wird
   nach Möglichkeit nicht noch einmal an einen gesetzt — stattdessen
   jemand, der noch nie dort sass.

Beide Kriterien werden gemeinsam optimiert (ein Tausch zählt, wenn er die
gewichtete Summe verbessert), nicht nacheinander — sonst könnte das
spätere das frühere wieder zunichtemachen.

**Ausnahme an der Grenze.** Besteht eine Hälfte aus einem einzigen Tisch
(z.B. bei 13 Anwesenden: oben ein 4er, unten drei 3er), kann sie
innerhalb ihrer selbst nichts tauschen, und in Match 2 sässen oben meist
wieder dieselben zusammen. Dann dürfen der unterste Tisch der oberen und
der oberste Tisch der unteren Hälfte untereinander tauschen — nur
Nicht-Sieger, nur um Rematches aufzulösen, unter gleich guten Tauschen der mit dem kleinsten
Rangabstand (es rutscht eher die Nummer 4 als die Nummer 1). Alle übrigen
Tische und die Tischgrössen bleiben unberührt; oben bleibt der 4er-Tisch.
In Match 1 gibt es noch keine Rematches, dort ändert sich nichts.
Entscheid des Organisators vom 13.10.2026: 4er-Tische oben sind wichtiger
als eine strikte Grenze.

### 5.3 Drop und Nachzügler

Die Anwesenden stehen beim Start fest, aber nicht unverrückbar: wer früher
geht, «droppt», und wer später kommt, wird nachgetragen. Beides ist
möglich, bis Match 2 live ist — danach ändert es an keiner Paarung mehr
etwas.

- **Drop**: Spieler an der Tischkachel antippen, neben der Krone erscheint
  «Drop».
  - Match 1 im Warteraum: er hat noch nicht gespielt, fliegt aus der Runde,
    und sie wird neu gemischt.
  - Match 1 live: er spielt sie zu Ende (seine Partie, sein Sieg und Spiel 1
    seiner Erfassung bleiben) und wird in Match 2 nicht eingeteilt. Seine
    Kachel zeigt ihn durchgestrichen.
  - Match 2 im Warteraum: wie eben, und Match 2 wird ohne ihn neu gemischt.
  Gespeichert wird der Drop an seiner Zuordnung der zuletzt gespielten
  Runde (`TableAssignment.droppedAt`).
- **Nachzügler** werden im Abschnitt «Anwesenheit» unter den Tischen aus
  den Liga-Teilnehmenden gewählt. Ist Match 1 noch im Warteraum, kommt er
  direkt dorthin (sie wird neu gemischt). Sonst spielt er ab Match 2 mit
  (`LateArrival`); steht Match 2 schon im Warteraum, wird sie mit ihm neu
  gemischt. Für Spiel 1 bekommt er nichts — auch keine Participation.
- **Rücknahme**: Gedroppte lassen sich zurückholen, Nachzügler entfernen,
  beides im Abschnitt «Anwesenheit» (ein Drop auch über die Tischkachel).
  Wer im Warteraum von Match 1 gedroppt wurde, ist schlicht nicht mehr
  dabei und wird bei Bedarf wieder als Nachzügler hinzugefügt.
- Neu gemischt wird immer nach denselben Regeln wie beim ersten Berechnen
  (Hälften, Sieg-Bonus, Rematch-Vermeidung). Manuelle Tausche in der
  betroffenen Runde gehen dabei verloren.

## 6. Spielerverwaltung

Der **Spieler-Tab** ist das zentrale Vereins-Roster, gebaut wie der
Achievement-Katalog (Abschnitt 11.1):

- Eine Tabelle aller Spieler mit Werkzeugleiste: Suche nach Name, Filter
  «Alle Spieler / Liga-Teilnehmende / Nicht in der Liga» und «+ Neuer
  Spieler». Spalten: **Liga** (Schalter), **Vorname**, **Nachname**,
  **Stufe**, **Farben** (Farbidentität, z. B. «WR», Abschnitt 13),
  **Deckliste** (Link, Abschnitt 13.1) und **Saison** (Total aus der
  Rangliste, nur lesend). Sortierbar nach Vor-
  und Nachname, Stufe und Saisonpunkten.
- Bearbeitet wird direkt in der Tabelle: ein Klick auf eine Zelle macht
  sie zum Eingabefeld, Enter oder Verlassen speichert, Esc verwirft. Die
  Liga-Teilnahme ist ein Schalter. Angelegt wird in einem Seitenpanel
  mit ausdrücklichem «Anlegen» (Vorname, optional Nachname, Stufe,
  Liga-Teilnahme).
- **«Achievements ›»** öffnet die Seite des Spielers: seine Abende als
  Reiter (Spalte, Datum, Punkte), darunter das Erfassungsblatt des
  gewählten Abends — bearbeitbar wie in der Erfassung (Abschnitt 12.3),
  auch für geschlossene und nachgetragene Abende; Änderungen wirken sofort
  auf die Rangliste. Dort steht auch «Spieler entfernen» (Abschnitt 6.2).
- Die **Skill-Einstufung** («Stufe», Skala 0-3, siehe
  `src/lib/players.ts`) wird bewusst **ohne Beschriftung** angeboten — nur
  die nackte Zahl. 0 bedeutet "noch nicht eingestuft" und wird bei der
  Zuteilung zufällig behandelt (Abschnitt 4.2). Sie ist komplett
  unabhängig vom Liga-Punktestand und dient ausschliesslich der
  ausgewogenen Zuteilung im Casual-Modus.
- Die **Liga-Teilnahme** (`leagueActive`) wird nur hier geändert. Sie wirkt
  rein zukunftsgerichtet: sie bestimmt, wer beim Start eines Liga-Abends
  zur Auswahl steht und wer in der Rangliste erscheint — bestehende Abende
  und Ergebnisse bleiben beim Deaktivieren unberührt, die Punkte sind beim
  erneuten Aufnehmen wieder da. Neu angelegte Spieler starten ohne
  Teilnahme, sofern beim Anlegen nichts anderes angehakt wurde.
- Es gibt kein Saison-Konzept: zum Saisonwechsel werden Teilnahmen manuell
  umgestellt.

### 6.1 Sichtbarkeit der Stufen-Einstufung

Die Stufen sollen die Spieler nicht mitbekommen. Sie erscheinen deshalb
nur dort, wo sie aktiv gepflegt werden:

- **sichtbar**: in den beiden Anlege-Formularen (Seitenpanel im
  Spieler-Tab und die Inline-Anlage im Casual-Tab) sowie als editierbare
  Spalte im Spieler-Tab.
- **nicht sichtbar**: in der Casual-Spielersuche, bei den ausgewählten
  Spielern und in den fertigen Tischzuteilungen — also überall dort, wo
  jemand beim Spielabend mitlesen könnte. Die öffentliche Lese-Ansicht
  (Abschnitt 8) zeigt ohnehin nie Stufen.

### 6.2 Spieler entfernen

Auf der Seite eines Spielers («Achievements ›» im Spieler-Tab) lässt sich
jeder Spieler entfernen. Was dabei
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

Der Liga-Tab führt nur noch durch den Abend. Die frühere Liga-Verwaltung
(Punkte, Abendzahl, Farben je Teilnehmendem) und der Text-Import der
Rangliste sind am 13.10.2026 entfallen: Punkte und Abende rechnet die App
aus der eigenen Rangliste (Abschnitt 5.1), die Farben werden im
Spieler-Tab gepflegt.

### 6.4 Auto-Save

Alle Felder speichern automatisch — Auswahlfelder und Schalter sofort bei
Änderung, Textfelder beim Verlassen des Feldes (Blur) bzw. mit Enter. Kein
expliziter "Speichern"-Klick nötig, kurzes visuelles Feedback ("✓
Gespeichert") bestätigt den Vorgang. Ausnahme ist das Anlegen eines
Spielers: ein halb ausgefülltes Formular soll nicht schon im Roster
landen.

## 7. Datenimport (entfallen)

Bis zum 13.10.2026 kopierte der Organisator die Rangliste von mtgbl.ch
als Text in einen Import-Dialog des Liga-Tabs. Seit die Abende R1–R4 aus
den Punkteblättern nachgetragen sind (Abschnitt 13.3) und alle späteren
in der App erfasst werden, ist die eigene Rangliste vollständig — der
Import ist entfallen. Die damals importierten Punkte pro Abend
(`ImportedEveningScore`) bleiben als Rückfall für Spalten ohne Abend aus
der App erhalten.

## 8. Verlauf / Historie

- Vergangene Liga-Abende (Datum, Tischzuteilungen je Runde, Sieger,
  Achievement-Erfassungen) werden dauerhaft gespeichert. Eine Ansicht
  dafür gibt es noch nicht. Casual hinterlässt keinen Verlauf
  (Abschnitt 4.3) — ein Abend ist in der App immer ein Liga-Abend.
- Zweck: Nachvollziehbarkeit der Saison, Basis für Statistiken. Wird
  **nicht** für saisonübergreifende Rematch-Vermeidung genutzt (siehe 5.2 —
  nur innerhalb desselben Abends).

## 9. Ausdrücklich ausserhalb des Scopes (v1)

- Kein Multi-User/Rollenmodell.
- Keine Ziehung der rotierenden Achievements in der App — die macht
  mtgbl.ch, die App übernimmt sie nur (Abschnitt 11). Die erreichten
  Achievements erfassen die Spieler selbst (Abschnitt 12), die Rangliste
  zeigt sie (Abschnitt 13).
- Kein Import/Sync mit mtgbl.ch — die App rechnet ihre Rangliste selbst,
  die offizielle Wertung wird von Hand übertragen.
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

## 11. Achievements

Die Liga vergibt Punkte über Achievements; massgeblich ist die Liste auf
https://mtgbl.ch/liga/commander/2026/achievements. Die App führt sie als
Katalog in der Ligaverwaltung, Reiter **«Achievements»** (Abschnitt 14).

### 11.1 Katalog

- Drei Kategorien: **fix**, **Deckbau** und **rotierend**. Es gilt, was
  **aktiv** ist: alle fixen und Deckbau-Achievements (solange aktiv) und
  bei den rotierenden die 10 der aktuellen Ziehung — zusammen
  üblicherweise 25.
- Je Achievement: Titel, Beschreibung, Punkte, Kategorie, **Art** und
  **aktiv**. Die Art ist eine von: 1x pro Match, 1x pro Runde, 1x am Ende
  der Liga, **pro Spieler** (z.B. «+1/Spieler») oder **mehrmals pro
  Abend**. Die letzten beiden zählen mehrfach; die Erfassung zeigt dort
  ein Anzahl-Feld statt eines Häkchens.
- Die Art wird beim Anlegen aus der Kategorie vorbelegt (fix und
  rotierend pro Match, Deckbau pro Runde) und ist danach änderbar —
  Evergreen ist Deckbau, zählt aber einmal am Ende der Liga.
- Variable Punktwerte der Website («+2/+1») werden mit dem höheren Wert
  geführt und bei der Erfassung korrigiert.
- Die Kategorie ist nach dem Anlegen nicht mehr änderbar.
- Der Katalog besteht aus drei Tabellen (fix, Deckbau, rotierend), die
  über Reiter mit Anzahl umgeschaltet werden. Darüber Suche und Filter
  nach Art und Status (standardmässig alle); Titel, Art und Punkte sind
  sortierbar. Spalten: Titel, Beschreibung, Art, Punkte, Aktiv. Über der
  Tabelle steht, wie viele im offenen Reiter aktiv sind («10 von 76
  aktiv»).
- Bearbeitet wird direkt in der Tabelle: ein Klick auf eine Zelle macht
  sie zum Eingabefeld, Enter oder Verlassen speichert, Esc verwirft. Die
  Spalte «Aktiv» ist ein Schalter, ein Klick stellt um. Die Reihenfolge
  bleibt dabei stehen; inaktive Zeilen sind abgeblendet.
  Angelegt wird in einem Seitenpanel mit ausdrücklichem «Anlegen».
- Achievements werden nie gelöscht, nur inaktiv gestellt.
- Die Startdaten (Stand 08.10.2026: 6 fixe, 9 Deckbau, 76 rotierende)
  stammen einmalig von der Website; danach wird nur in der App gepflegt.

### 11.2 Vom Ende eines Liga-Abends bis zum nächsten

1. **Abend beenden** im Liga-Tab. Die 25 Achievements des Abends bleiben
   bei ihm gespeichert.
2. **mtgbl.ch zieht** die 10 rotierenden für den nächsten Abend und
   veröffentlicht sie (ausserhalb der App).
3. In der Ligaverwaltung unter «Achievements», Reiter **Rotierend**, werden die 10 neuen
   **aktiv** und die bisherigen **inaktiv** gestellt. Jeder Klick
   speichert sofort. Ohne Sperre auf 10, weil die Ziehung übernommen und
   nicht hier entschieden wird; die Anzeige «10 von 76 aktiv» dient zur
   Kontrolle.
4. Beim **Start des nächsten Liga-Abends** übernimmt der Abend, in
   derselben Transaktion wie Runde und Match 1, alle aktiven
   Achievements als **eingefrorene Kopie** (Titel, Beschreibung, Punkte,
   Kategorie, Art). Der Katalog bleibt unverändert — die rotierenden
   bleiben aktiv, bis nach der nächsten Ziehung umgestellt wird.

Ein gestarteter Abend behält seine Liste: Änderungen im Katalog wirken
erst auf den nächsten Abend, auch während ein Abend läuft.

### 11.3 Öffentliche Ansicht

Während ein Liga-Abend läuft, zeigt die öffentliche Lese-Ansicht unter den
Tischen die geltenden Achievements des Abends, nach Kategorie gruppiert.

## 12. Achievement-Erfassung durch die Spieler

Die Spieler erfassen ihre Achievements am Liga-Abend selbst auf dem Handy.
Der Papierzettel bleibt als Rückfall: wer kein Handy nutzt, gibt ihn ab,
und der Organisator erfasst für ihn.

### 12.1 Anmeldung über Tischkarten

- In der Ligaverwaltung unter **Tischkarten** gibt
  es eine Druckvorlage mit QR-Codes für **Tisch 1–6** (Drucken → «Als PDF
  sichern» ergibt das PDF). Die Karten werden einmal gedruckt und bleiben
  gültig: der QR-Code enthält nur `/tisch/<nr>`, nicht den Abend.
- Die Tischseite zeigt die Spieler, die in der **aktuellen
  veröffentlichten Runde** an diesem Tisch sitzen. Ein Antippen meldet das
  Handy für diesen Namen an. Es braucht kein Konto und keinen Code.
- Das Handy bekommt ein zufälliges Token als Cookie (14 Tage gültig), in
  der Datenbank steht nur dessen Hash. **Ein Name pro Handy und Abend**,
  und ein angemeldeter Name ist für andere Handys gesperrt. Der
  Organisator kann ihn freigeben («Handy freigeben»), die Einträge bleiben
  dabei erhalten. Die Anmeldung ist atomar: tippen zwei Handys
  gleichzeitig denselben Namen an, gewinnt eines.
- Die Tischkarten sind dauerhaft und damit nicht geheim. Schutz bieten
  die Beschränkung auf die Spieler des Tisches, die Namenssperre und die
  Prüfung durch den Organisator. Eine Tischseite funktioniert nur, solange
  eine Erfassung offen ist.

### 12.2 Erfassungsblatt

- Für jedes gespielte Match (Match 1, Match 2) gibt es die fixen und
  rotierenden Achievements mit Art «1x pro Match» oder «pro Spieler»,
  dazu alles, was einmal pro Runde zählt (Deckbau, «mehrmals pro
  Runde»). «1x am Ende der Liga» (Evergreen) erscheint nur in der letzten
  Runde der Saison.
- **In Schritten** auf dem Handy des Spielers: **Deckbau** (alles für die
  ganze Runde) → **Match 1** → **Match 2** → **Abgeben**. Ein Match lässt
  sich erfassen, sobald es live ist; vorher zeigt der Schritt einen
  Hinweis, und wer ein Match nicht gespielt hat (Drop, Nachzügler), sieht
  genau das. Die Schritte oben sind jederzeit antippbar, unten
  führen «← / →» weiter. Der Browser merkt sich den zuletzt offenen
  Schritt; ohne Speicher beginnt das Blatt bei Deckbau. «Abgeben» zeigt
  eine Übersicht je Match und warnt, solange ein Match noch aussteht.
- Der Organisator (Papierzettel, Korrekturen in der Ligaverwaltung) sieht
  das ganze Blatt auf einer Seite.
- Mehrfach zählende Achievements («pro Spieler», «mehrmals pro Runde»)
  haben ein Anzahl-Feld (− / +, höchstens 20), alle anderen ein Häkchen.
- **Participation** setzt die App für jedes gespielte Spiel automatisch,
  es ist nicht änderbar. «Winner winner» trägt der Spieler selbst ein.
- Oben steht die laufende Summe mit Teilsummen **Core / Deckbau /
  Rotate**, wie auf dem Punkteblatt. Jede Änderung speichert sofort.
- Grundlage sind die eingefrorenen Achievements des Abends (Abschnitt
  11.2). Der Server prüft jede Änderung: Das Achievement muss zum Abend
  gehören, das Spiel muss gespielt sein, und die Anzahl muss erlaubt sein.
- **Die Spieler ändern ihr Blatt selbst, bis die Erfassung geschlossen
  wird** — auch nach **Abgeben** (mit Rückfrage), das nur noch «ich bin
  fertig» meldet und in der Übersicht als «Abgegeben» erscheint. Danach
  korrigiert nur noch der Organisator (Abschnitt 12.3).

### 12.3 Organisator

- Der Liga-Tab zeigt, solange eine Erfassung offen ist, den Hinweis
  «Achievement-Erfassung offen» mit Anzahl der Abgaben. Er bleibt auch
  nach «Runde beenden» stehen.
- In der Ligaverwaltung unter **Aktuelle Runde** stehen alle Anwesenden
  mit Status (nicht angemeldet / erfasst gerade / abgegeben) und Total.
  Pro Spieler gibt es «Korrigieren» (dasselbe Blatt, für Korrekturen und
  Papierzettel, mit «Als abgegeben markieren») und «Handy freigeben».
  «Wieder öffnen» ist entfallen — Spieler können bis zum Schliessen
  ohnehin ändern.
- **Nur der Organisator korrigiert nach dem Schliessen**: unter «Runden»
  lässt sich jedes Blatt jeder Runde korrigieren, auch geschlossener und
  nachgetragener. Die Rangliste folgt sofort.
- **Erfassung schliessen** (mit Rückfrage) beendet die Erfassung des
  Abends. Danach können die Spieler nichts mehr ändern, und der Abend
  zählt in der Rangliste. Die Rückfrage bestätigt zugleich die **Spalte**
  (R1–R6), in der er zählt — aus dem Datum vorbelegt und änderbar —, oder
  «Testrunde — zählt nicht». Jede Spalte gehört höchstens einem Abend der
  Saison; ist sie schon vergeben, lehnt die App ab und nennt den Abend. Startet ein neuer Liga-Abend, wird eine noch
  offene Erfassung automatisch geschlossen. Es gibt immer nur eine
  offene Erfassung.
- Welcher Liga-Abend (1–6) ein Abend ist, leitet die App aus den
  Terminen auf mtgbl.ch ab (`src/lib/season.ts`). Bei einer
  Terminverschiebung muss die Liste angepasst werden. Ein Abend nach dem
  letzten Termin liegt ausserhalb der Saison: er bekommt keine Nummer und
  zählt nicht als letzter Abend — sonst erschiene Evergreen bis zum
  Nachführen der Liste an jedem Abend.

## 13. Rangliste

Öffentlich unter `/rangliste`, ohne Login — dieselbe Rangliste wie auf
mtgbl.ch, zusätzlich mit den erreichten Achievements pro Abend. Die
offizielle Wertung bleibt auf mtgbl.ch.

### 13.1 Inhalt

- **Spalten** wie auf mtgbl.ch: #, Δ, Spieler, F (Farbidentität als
  farbige Punkte in den Magic-Farben W, U, B, R, G), Total, R1–R6.
- **Deckliste**: hat ein Spieler einen Link zu seiner Deckliste
  (Spieler-Tab, Spalte «Deckliste»), steht neben seinen Farben ein Icon,
  das sie in einem neuen Tab öffnet (`rel="noopener noreferrer"`).
  Gespeichert werden nur http(s)-Adressen; ohne Schema eingegebene
  bekommen https:// (`src/lib/decklist.ts`).
- **Farben setzen**: die Farbidentität wird im Spieler-Tab gepflegt. Für
  die ganze Saison auf einmal liest `npm run set:colors -- <datei.json>`
  eine Liste im Format `[{ "name": "Marc S.", "colors": "WR" }, …]` mit
  den Namen, wie mtgbl.ch sie führt (Probelauf, mit `--apply` schreiben).
  Jeder Name muss genau einem Spieler zuzuordnen sein
  (`src/lib/nameMatch.ts`), sonst schreibt das Skript nichts. Die Datei
  enthält Namen und liegt deshalb in `information-files/`.
- **Wer erscheint**: alle Liga-Teilnehmenden (`leagueActive`), auch ohne
  gespielten Abend (Total 0). Massgebend ist allein der Haken im
  Spieler-Tab.
- **Abendpunkte**: aus der Achievement-Erfassung (Abschnitt 12), für R1–R4
  aus den nachgetragenen Abenden (Abschnitt 13.3); wo eine Spalte keinen
  Abend aus der App hat, aus dem früheren Import (Abschnitt 7).
  Ein Abend aus der App zählt erst, wenn seine Erfassung geschlossen und
  einer Spalte zugeordnet ist (Abschnitt 12.3). Gibt es für eine Spalte
  einen Abend aus der App, gilt er für alle — auch für wen der Import dort
  einen Wert hätte. Wer am Abend an einem Tisch sass, aber nichts erfasst
  hat, bekommt die automatische Participation.
- **Total** rechnet die Rangliste selbst aus den Abendpunkten. Dieselben
  Abendpunkte bestimmen die Paarung von Match 1 (Abschnitt 5.1).
- **Rang**: gleiches Total heisst gleicher Rang (1, 2, 2, 4), innerhalb
  eines Rangs alphabetisch.
- **Streichresultat**: während der Saison zählt die Summe aller Abende.
  Sobald R6 Punkte hat, wird je Spieler das schlechteste Resultat
  gestrichen und durchgestrichen angezeigt. Ein verpasster Abend zählt als
  0 und ist damit das schlechteste; bei mehreren gleich schlechten trifft
  es den letzten.
- **Δ**: Veränderung gegenüber dem Stand vor dem letzten Abend (höchste
  Spalte mit Punkten), nach denselben Regeln gerechnet — ▲ grün, ▼ rot,
  nichts bei gleichem Rang. Wer vor dem letzten Abend noch keinen hatte,
  bekommt «neu». Nach R6 vergleicht Δ den Stand mit Streichresultat mit
  dem nach R5 ohne. Vor dem zweiten Abend gibt es kein Δ.
- Bis es ein Saison-Objekt gibt (BACKLOG.md), gilt als Saison das
  Kalenderjahr bis zum letzten Termin (`src/lib/season.ts`).

### 13.2 Details pro Abend

- Punkte aus der App sind **unterstrichen**; importierte Abende haben
  keine Details und sind nicht markiert.
- Die Details zeigen Spieler, Spalte, Datum und Punkte des Abends, darunter
  gegliedert wie das Punkteblatt: **Spiel 1**, **Spiel 2** und **Ganzer
  Abend** (Deckbau, «mehrmals pro Abend», Evergreen), je mit Teilsumme;
  pro Achievement Titel, Punkte und bei mehrfach zählenden die Anzahl
  (×3). Participation steht mit drin, damit die Summen aufgehen.
- **Geräte, die hovern können** (Maus, Trackpad): ein kleines Popover
  direkt an der Zahl, beim Hovern und beim Fokussieren per Tastatur.
- **Touch-Geräte**: ein **Bottom Sheet**, das sanft von unten hochfährt
  (250 ms), die Seite dahinter abgedunkelt. Schliesst mit Tippen daneben,
  mit ×, mit Escape und mit der Zurück-Geste. Unterschieden wird nach
  Fähigkeit (`hover: hover`), nicht nach Bildschirmbreite — ein Tablet mit
  Touch bekommt das Sheet.

### 13.3 Nachgetragene Abende

Die Abende vor der Selbsterfassung (R1–R4) lassen sich aus den
Punkteblättern nachtragen, damit auch sie Details haben. Ein
nachgetragener Abend ist ein gewöhnlicher Abend der App — mit seinen 25
Achievements (fix und Deckbau aus dem Katalog, dazu die 10 rotierenden
der damaligen Ziehung), einer Erfassung pro Spieler und geschlossener
Erfassung in seiner Spalte. Tische hat er keine: welche Spiele jemand
gespielt hat, steht stattdessen in der Erfassung (`PlayerEntry.games`).

- Eingespielt wird mit `npm run import:evening -- <datei.json>` (Probelauf)
  bzw. `… --apply`; das Format steht in `scripts/import-evening.ts`. Die
  Datei mit Namen und Achievements liegt in `information-files/` und
  gehört nicht ins öffentliche Repository.
- **mtgbl.ch ist massgeblich**: jeder Spieler trägt das Abendtotal von
  mtgbl.ch mit. Weicht die Summe seiner Achievements davon ab, schreibt
  das Skript nichts. Unklare oder widersprüchliche Blätter werden vorher
  mit dem Organisator geklärt.
- Eine schon belegte Spalte lehnt das Skript ab.
- Spieler mit einer Erfassung, aber ohne Tische, werden beim Entfernen
  archiviert statt gelöscht — ihre Punkte gehören zur Rangliste.

### 13.4 Auf dem Handy

Rang mit Δ, Spieler (mit den Farbpunkten) und Total bleiben links
fixiert, die Spalten R1–R6 scrollen horizontal. Die Seite selbst scrollt
nie seitlich.

## 14. Ligaverwaltung

Alles, was die Liga ausserhalb des Spielabends braucht, unter
`/admin/ligaverwaltung` mit vier Reitern (gestaltet wie die Reiter im
Achievement-Katalog):

- **Aktuelle Runde** — die Achievement-Erfassung der offenen Runde
  (Abschnitt 12.3): Status und Total je Spieler, «Korrigieren», «Handy
  freigeben», «Erfassung schliessen». Ist keine Erfassung offen, steht
  hier die Vorbereitung der nächsten Runde: Nummer und Datum laut
  Terminliste, ob genau 10 rotierende Achievements aktiv sind (mit Link
  zum Katalog), und der Hinweis, dass im Liga-Tab gestartet wird.
- **Runden** — alle Runden, die neueste zuoberst, mit Spalte (R1–R6,
  «Testrunde»), Datum, Zahl der Teilnehmenden und Status (läuft /
  Erfassung offen / geschlossen / nachgetragen). Pro Runde: die
  Teilnehmenden mit ihren Matches und Punkten (je «Korrigieren ›»), die
  Tische und Sieger von Match 1 und 2 (mit Drop und Unentschieden) und
  die Achievements, die in dieser Runde galten.
  **Jede Runde lässt sich löschen** — endgültig, mit Rückfrage, samt
  Matches, Tischen und Erfassungen (Entscheid des Organisators vom
  13.10.2026). Die Rückfrage nennt, was verloren geht: bei einer laufenden
  Runde Tische und Erfassungen, bei offener Erfassung die Einträge der
  Spieler, bei einer gezählten die Punkte in Rangliste und Paarung (für
  R1–R4 gelten dann wieder die früher importierten Werte, falls vorhanden,
  Abschnitt 7).
- **Achievements** — der Katalog (Abschnitt 11).
- **Tischkarten** — die Druckvorlage (Abschnitt 12.1).

Die früheren Adressen `/admin/erfassung` und `/admin/achievements` leiten
hierher um (`next.config.ts`). Im Spieler-Tab zeigt die Seite eines
Spielers seine Achievements pro Runde nur noch an, mit einem Link zum
Korrigieren hier.
