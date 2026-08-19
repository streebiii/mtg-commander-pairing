# Commander Pairing-Software — Spezifikation

Stand: 2026-08-18 (nach Grill-Session mit dem Auftraggeber)

## 1. Zweck

Web-App zur Organisation von 4-Spieler-Commander-Turnierabenden (Magic: The
Gathering). Kernaufgabe: Spieler fair und regelkonform auf Tische verteilen
("Pairing"), in zwei unterschiedlichen Modi.

## 2. Nutzerkreis & Zugriff

- **Single-User (Organisator)**: eine Person verwaltet Spieler, Abende,
  Pairings und Ergebnisse. Kein Multi-User, keine Rollen/Rechte.
- **Zugriffsschutz**: einfacher Passwort-/PIN-Schutz für den
  Organisator-Bereich (Anlegen, Bearbeiten, Ergebnisse eintragen).
- **Öffentliche Lese-Ansicht**: separate URL ohne Login, zeigt nur die
  aktuellen Tischzuteilungen des laufenden Abends (z. B. für einen Bildschirm
  vor Ort oder zum Teilen mit den Spielern). Keine Bearbeitungsmöglichkeit.
- **Hosting**: auf einem bestehenden eigenen Server des Auftraggebers.
  Details zur Server-Umgebung (OS, Docker-Verfügbarkeit, Node-Version o. Ä.)
  sind noch nicht bekannt und werden vor dem Deployment geklärt. Für die
  Entwicklung wird eine möglichst portable Lösung (z. B. Docker-Container)
  angestrebt, um die Abhängigkeit von Server-Details gering zu halten.

## 3. Tischgrößen-Algorithmus (gemeinsame Basis für beide Modi)

Ziel: aus N anwesenden Spielern eine Aufteilung auf Tische bestimmen.

**Priorität (überarbeitet — 5er-Tische sind absoluter Ausnahmefall):**
1. **5er-Tische nur, wenn eine Aufteilung ausschließlich mit 3er- und
   4er-Tischen für die gesamte Gruppe mathematisch unmöglich ist.** Da 3 und
   4 teilerfremd sind, lässt sich jede Spielerzahl N ≥ 6 immer als reine
   Kombination aus 3er- und 4er-Tischen darstellen (Frobenius-Zahl von 3
   und 4 ist 5). Ein 5er-Tisch ist demnach **nur bei N = 5 zwingend
   erforderlich** — es gibt keinen anderen Fall, in dem eine reine 3/4-
   Lösung nicht existiert.
2. Innerhalb der gültigen reinen 3er/4er-Kombinationen: so viele 4er-Tische
   wie möglich, Rest mit 3er-Tischen auffüllen (klassisches Prinzip
   "möglichst wenige, möglichst große Tische").
3. Gültige Tischgrößen sind grundsätzlich 3, 4, 5 — 5 aber wie oben nur im
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

## 4. Modus A — Casual-Rechner + Zuteilung

- Eingabe: Anzahl anwesender Spieler (oder Auswahl aus der
  Spielerdatenbank).
- Ausgabe: Tischverteilung (Anzahl & Größe der Tische) gemäß Algorithmus
  aus Abschnitt 3, plus zufällige Zuteilung der konkreten Spieler auf die
  Tische.
- **Einzelrunde**: keine Mehrrunden-Logik, keine Rematch-Vermeidung.
- **Keine Ergebnis-/Punkteerfassung**, keine Verlaufsspeicherung — rein für
  lockere Spieleabende ohne Bezug zur Liga-Rangliste.
- Organisator kann die zufällige Zuteilung manuell anpassen (Spieler
  zwischen Tischen tauschen) vor der Anzeige/Veröffentlichung.
- Bei der Spielerauswahl kann direkt ein neuer Spieler angelegt werden
  (Vorname, optional Nachname, optional Skill-Einstufung), falls jemand
  auftaucht, der noch nicht in der Datenbank ist — ohne dafür extra in die
  Spielerverwaltung wechseln zu müssen. Punktestand startet dabei bei 0.

### 4.1 Zuteilungsart: Zufällig vs. skill-balanciert

Vor der Berechnung wählt der Organisator zwischen zwei Untermodi:

- **Zufällig** (Standard): wie oben beschrieben, keine Berücksichtigung von
  Skill-Level.
- **Nach Skill balanciert**: nutzt dieselbe Rang-Gruppierungs-Logik wie
  Modus B (Abschnitt 5.1), aber mit der Skill-Einstufung der Spieler
  (Abschnitt 6) statt Liga-Punkten als Sortier-Kriterium, inkl. Zufalls-
  Rauschen (±1 Skill-Stufe — kleiner als bei der Liga, da die Skala nur
  0-3 umfasst), damit nicht stur die exakt gleich starken Spieler
  zusammen landen.
  - Unbewertete Spieler (Skill = 0, "weiß ich nicht") werden für die
    Berechnung so behandelt, als hätten sie den Mittelwert der bewerteten
    anwesenden Spieler (bzw. den Skalen-Mittelwert 2, falls niemand
    bewertet ist) — sie landen dadurch tendenziell in der Mitte statt
    automatisch am schwächsten Tisch.
  - Weiterhin keine Persistenz, kein Verlauf, keine Rematch-Vermeidung
    (Modus A bleibt Einzelrunde).
  - Die Skill-Werte sind nur im Organisator-Bereich sichtbar (Auswahl-
    Liste und Ergebnis-Tische) — die öffentliche Lese-Ansicht zeigt
    ohnehin ausschließlich Modus-B-Abende (Abschnitt 8), Skill-Level
    tauchen dort also nie auf.

## 5. Modus B — Liga-Rangliste-Pairing

- Kontext: bestehende Saison-Liga mit Achievement-basiertem Punktesystem
  (siehe https://mtgbl.ch/liga/commander/2026/achievements — 25
  Achievements pro Abend, u. a. Teilnahme, Sieg, erste Eliminierung,
  Deckbau- und rotierende Achievements). Die App bildet **nicht** das
  komplette Achievement-Sheet ab — der Organisator trägt nach jeder Runde
  nur die **Gesamtpunktsumme pro Spieler** ein.
- **Ablauf pro Abend:**
  1. Anwesende Spieler aus der Spielerdatenbank auswählen.
  2. **Runde 1**: Sortierung nach aktuellem Gesamt-Liga-Punktestand
     (Stand vor diesem Abend). Tischverteilung gemäß Algorithmus aus
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
- **Tie-Break bei Punktegleichstand**: zufällige Reihenfolge.
- **Rematch-Vermeidung**: weiches Kriterium, gilt nur **innerhalb desselben
  Abends** (nicht saisonübergreifend). Priorität bleibt die
  Tischgrößenverteilung aus Abschnitt 3 — Rematch-Vermeidung darf diese
  nicht verletzen, wird also nur angewendet, wenn mehrere Zuteilungen mit
  gleicher Tischgrößen-Verteilung möglich sind.
- Organisator kann jede vorgeschlagene Zuteilung manuell anpassen (Spieler
  zwischen Tischen tauschen).

### 5.1 Sortier-/Gruppierungsregel für die Tischzuteilung

Spieler werden nach Punktestand absteigend sortiert, wobei ein kleines
Zufalls-Rauschen (`RANK_JITTER_POINTS`, aktuell ±3 Punkte) auf den
Punktestand addiert wird, bevor sortiert wird. Danach werden sie gemäß
der berechneten Tischgrößen (Abschnitt 3) in aufeinanderfolgende Blöcke
eingeteilt (Spieler 1–4 an Tisch 1, 5–8 an Tisch 2 usw., je nach
Tischgröße) — analog zu einer Swiss-Pairing-Gruppierung nach Rang. Bei
Punktegleichstand (oder durch das Rauschen entstandenem Beinahe-
Gleichstand) am Blockrand wird zufällig entschieden, wer in welchem
Block landet.

Das Rauschen sorgt dafür, dass benachbarte Ränge sich gelegentlich die
Plätze tauschen — es spielen also nicht jeden Abend zwangsläufig exakt
dieselben Spieler 1–4 zusammen, 5–8 zusammen usw., auch wenn sich die
Punktestände zwischen den Abenden kaum ändern. Spieler mit großem
Punkteabstand (mehr als ca. 2× das Rauschen) werden dabei nie
miteinander gemischt — die grundsätzliche "stärkere Spieler spielen
eher gegeneinander"-Logik bleibt erhalten.

Der Organisator kann eine Runde außerdem jederzeit (solange noch keine
Ergebnisse für sie eingetragen wurden) neu auswürfeln lassen ("Neu
mischen"-Button), falls ihm der erste Vorschlag nicht zusagt.

### 5.2 Rematch-Vermeidung — Umsetzung

Bei der Neupaarung für Runde 2/3 wird, wenn mehrere Spieler mit
(näherungsweise) gleichem Punktestand für die Randposition eines
Tisch-Blocks infrage kommen, derjenige bevorzugt, der in der/den
vorherigen Runde(n) dieses Abends noch nicht mit den anderen Spielern des
Ziel-Tisches zusammen gespielt hat. Die Tischgrößenverteilung selbst
(Abschnitt 3) bleibt davon unberührt.

## 6. Spielerverwaltung

- Persistente Spielerdatenbank: Spieler einmalig anlegen (Vorname,
  optional Nachname), bei jedem Abend nur noch als „anwesend“
  markieren/auswählen.
- Enthält je Spieler den aktuellen Gesamt-Liga-Punktestand (wird durch
  Ergebniserfassung in Modus B fortgeschrieben).
- Enthält je Spieler eine optionale **Skill-Einstufung** (0-3):
  - 0 = "weiß ich nicht" / unbewertet
  - 1 = Anfänger
  - 2 = Medium
  - 3 = erfahrener Spieler (mehrjährig)

  Komplett unabhängig vom Liga-Punktestand, wird ausschließlich für den
  skill-balancierten Modus A verwendet (Abschnitt 4.1). Editierbar an
  derselben Stelle wie Name/Punkte.

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

## 9. Ausdrücklich außerhalb des Scopes (v1)

- Kein Multi-User/Rollenmodell.
- Keine Digitalisierung des vollständigen Achievement-Sheets (25 Punkte pro
  Abend einzeln) — nur Gesamtsumme pro Spieler/Runde.
- Kein automatischer Import/Sync mit mtgbl.ch.
- Keine saisonübergreifende Rematch-Vermeidung.
- Keine Sonderbehandlung für „zu wenige Spieler" (< 3 anwesend) — tritt
  laut Auftraggeber nicht auf.
- Modus A speichert keine Ergebnisse/Punkte und keinen Verlauf.

## 10. Offene technische Fragen (vor Deployment zu klären)

- Umgesetzt als Docker-Container (Next.js + SQLite), siehe
  [DEPLOYMENT.md](./DEPLOYMENT.md) — das macht die App unabhängig von der
  genauen Server-Umgebung, solange Docker installiert ist.
- Weiterhin offen: ob auf dem Server bereits Docker läuft, und ob/wie ein
  Reverse Proxy mit eigener Domain/HTTPS davor gesetzt wird (bewusst nicht
  Teil dieses Setups, siehe DEPLOYMENT.md).
