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
- **Im skill-balancierten Modus** (Abschnitt 4.2 unten) zählt eine Gruppe
  als eine Einheit mit dem **Durchschnitts-Skill** ihrer Mitglieder und
  wird damit als Ganzes in die passende Stärke-Region einsortiert.
- **Persistenz**: Anwesenheits-Auswahl und Gruppen leben zusammen im
  Browser-Speicher (localStorage) des Organisator-Geräts, nicht in der
  Datenbank — keine Migration nötig. Spieler, die inzwischen archiviert
  oder gelöscht wurden, fallen beim Laden still heraus. "Zurücksetzen"
  (siehe oben) lässt Auswahl und Gruppen unangetastet; aufgelöst werden
  Gruppen nur über die eigenen Knöpfe (× je Gruppe, "alle auflösen").
- In der fertigen Tischzuteilung erscheinen die Gruppen-Kürzel auch an den
  Tischkacheln. Manuelles Tauschen (siehe oben) bleibt uneingeschränkt
  möglich, auch wenn es eine Gruppe trennt — der Organisator ist die letzte
  Instanz. Elo-Werte bleiben dabei wie überall unsichtbar.

### 4.2 Zuteilungsart: Zufällig vs. skill-balanciert

Vor der Berechnung wählt der Organisator zwischen zwei Untermodi:

- **Zufällig** (Standard): wie oben beschrieben, keine Berücksichtigung von
  Skill-Level.
- **Nach Skill balanciert**: nutzt dieselbe Rang-Gruppierungs-Logik wie
  die Liga (Abschnitt 5.1), aber mit der Skill-Einstufung der Spieler
  (Abschnitt 6) statt Liga-Punkten als Sortier-Kriterium, inkl. Zufalls-
  Rauschen (±1 Skill-Stufe — kleiner als bei der Liga, da die Skala nur
  0-3 umfasst), damit nicht stur die exakt gleich starken Spieler
  zusammen landen.
  - Für noch nicht eingestufte Spieler (Elo = 0) wird pro Berechnung eine
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
- Gespeichert wird ausschliesslich, damit die öffentliche Lese-Ansicht die
  Tische zeigen kann — ohne das sähe sie niemand ausser dem Organisator.
- Öffentlich wird immer nur **eines von beidem** gezeigt: existiert eine
  Casual-Zuteilung, hat sie Vorrang; sonst der laufende Liga-Abend. Das
  Starten eines Liga-Abends verwirft eine offene Casual-Zuteilung, damit
  die Regel nicht aufweichen kann.

## 5. Liga — Rangliste-Pairing

- Kontext: bestehende Saison-Liga mit Achievement-basiertem Punktesystem
  (siehe https://mtgbl.ch/liga/commander/2026/achievements — 25
  Achievements pro Abend, u. a. Teilnahme, Sieg, erste Eliminierung,
  Deckbau- und rotierende Achievements). Die App bildet **nicht** das
  komplette Achievement-Sheet ab — der Organisator trägt nach jeder Runde
  nur die **Gesamtpunktsumme pro Spieler** ein.
- **Ablauf pro Abend:**
  1. Anwesende Spieler aus den Liga-teilnehmenden Vereinsspielern auswählen
     (siehe Abschnitt 6 — nicht jeder Vereinsspieler nimmt an der Liga teil).
  2. **Runde 1**: Sortierung nach aktuellem Gesamt-Liga-Punktestand
     (Stand vor diesem Abend). Tischverteilung gemäss Algorithmus aus
     Abschnitt 3, Spieler in Punktereihenfolge auf die Tische verteilt
     (übliche Pairing-Logik: nach Rang gruppieren/verteilen, siehe Abschnitt
     5.1 für Detailregel).
  3. Organisator trägt nach der Runde die erzielten Punkte pro Spieler ein.
  4. **Runde 2 (und ggf. 3)**: Neusortierung nach **aktualisiertem**
     Gesamt-Liga-Punktestand (bisheriger Saisonstand + Punkte aus
     Runde 1 [+ Runde 2]). Neue Tischverteilung, unter Berücksichtigung der
     weichen Rematch-Vermeidung (Abschnitt 5.2).
  5. Bis zu 3 Runden pro Abend, flexibel — nach jeder Runde entscheidet der
     Organisator, ob eine weitere Runde gepaart wird.
- **Abend verwerfen**: solange kein einziges Ergebnis erfasst ist, lässt
  sich ein Abend komplett verwerfen. Ohne das käme man aus einem
  versehentlichen Start nicht mehr heraus — "Abend beenden" verlangt
  vollständige Ergebnisse, und solange der Abend läuft, sind die
  beteiligten Spieler nicht löschbar (Abschnitt 6.2). Sobald Ergebnisse
  erfasst sind, ist Verwerfen gesperrt: dann hängen bereits
  fortgeschriebene Liga-Punkte daran.
- **Tie-Break bei Punktegleichstand**: zufällige Reihenfolge.
- **Rematch-Vermeidung**: weiches Kriterium, gilt nur **innerhalb desselben
  Abends** (nicht saisonübergreifend). Priorität bleibt die
  Tischgrössenverteilung aus Abschnitt 3 — Rematch-Vermeidung darf diese
  nicht verletzen, wird also nur angewendet, wenn mehrere Zuteilungen mit
  gleicher Tischgrössen-Verteilung möglich sind.
- Organisator kann jede vorgeschlagene Zuteilung manuell anpassen (Spieler
  zwischen Tischen tauschen).

### 5.1 Sortier-/Gruppierungsregel für die Tischzuteilung

Spieler werden nach Punktestand absteigend sortiert, wobei ein kleines
Zufalls-Rauschen (`RANK_JITTER_POINTS`, aktuell ±3 Punkte) auf den
Punktestand addiert wird, bevor sortiert wird. Danach werden sie gemäss
der berechneten Tischgrössen (Abschnitt 3) in aufeinanderfolgende Blöcke
eingeteilt (Spieler 1–4 an Tisch 1, 5–8 an Tisch 2 usw., je nach
Tischgrösse) — analog zu einer Swiss-Pairing-Gruppierung nach Rang. Bei
Punktegleichstand (oder durch das Rauschen entstandenem Beinahe-
Gleichstand) am Blockrand wird zufällig entschieden, wer in welchem
Block landet.

Das Rauschen sorgt dafür, dass benachbarte Ränge sich gelegentlich die
Plätze tauschen — es spielen also nicht jeden Abend zwangsläufig exakt
dieselben Spieler 1–4 zusammen, 5–8 zusammen usw., auch wenn sich die
Punktestände zwischen den Abenden kaum ändern. Spieler mit grossem
Punkteabstand (mehr als ca. 2× das Rauschen) werden dabei nie
miteinander gemischt — die grundsätzliche "stärkere Spieler spielen
eher gegeneinander"-Logik bleibt erhalten.

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
    Nachname, Elo, optional direkt als Liga-Teilnehmer).
  - Enthält je Spieler eine optionale **Skill-Einstufung** auf der Skala
    0-3, im Organisator-UI als "Elo" bezeichnet (verdecktes Rating, siehe
    `src/lib/players.ts`). Die Stufen werden bewusst **ohne Beschriftung**
    angeboten — die Dropdowns zeigen nur die nackte Zahl. 0 bedeutet "noch
    nicht eingestuft" und wird bei der Zuteilung zufällig behandelt
    (Abschnitt 4.2).

    Komplett unabhängig vom Liga-Punktestand, wird ausschliesslich für die
    elo-balancierte Zuteilung im Casual-Modus verwendet (Abschnitt 4.2).
  - Zeigt und ändert die **Liga-Teilnahme** (`leagueActive`) pro Spieler.
  - Zeigt **keine** Liga-Punkte — die werden im Liga-Tab gepflegt.

### 6.1 Sichtbarkeit der Elo-Einstufung

Die Elo-Werte sollen die Spieler nicht mitbekommen. Sie erscheinen deshalb
nur dort, wo sie aktiv gepflegt werden:

- **sichtbar**: in den beiden Anlege-Formularen (Spieler-Tab und die
  Inline-Anlage im Casual-Tab) sowie als editierbare Spalte im Spieler-Tab.
- **nicht sichtbar**: in der Casual-Spielersuche, bei den ausgewählten
  Spielern und in den fertigen Tischzuteilungen — also überall dort, wo
  jemand beim Spielabend mitlesen könnte. Die öffentliche Lese-Ansicht
  (Abschnitt 8) zeigt ohnehin nie Elo-Werte.

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

- Enthält je Spieler den aktuellen Gesamt-Liga-Punktestand (wird durch
  Ergebniserfassung in der Liga fortgeschrieben, hier aber auch manuell
  editierbar) sowie — wie der Spieler-Tab — die **Liga-Teilnahme-Flag**.
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

- Die aktuelle Saison-Rangliste (Spielernamen + Punktestand) liegt aktuell
  nur einsehbar auf mtgbl.ch vor. Der Organisator trägt Spieler und
  Punktestand **manuell** einmalig in die neue App ein — kein
  automatisierter Import/Scraping.

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
