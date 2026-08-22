# Backlog

Ideen und zukünftige Vorhaben, die noch nicht spruchreif genug für einen
Grill (`/mattpocock-skills:grill-me`) sind. Grob gehalten mit Absicht —
Ausarbeitung passiert erst, wenn ein Eintrag tatsächlich angegangen wird.

## Casual: einzelne Tische selektiv neu mischen

**Status:** Idee, noch nicht ausgearbeitet.

**Worum es geht:** Nach dem Auswürfeln der Casual-Tische soll der
Organisator gezielt einzelne Tische auswählen können (z. B. Tisch 1 und
Tisch 3), die dann **untereinander** neu gemischt werden — statt wie
heute entweder gar nicht (nur manueller Einzeltausch, siehe
`handlePlayerClick` in `CasualClient.tsx`) oder komplett neu für alle
Tische ("Tische berechnen" ersetzt die gesamte Zuteilung).

**Offen:**
- Was passiert mit Gruppen (siehe SPEC.md Abschnitt 4.1), deren
  Mitglieder auf ausgewählten Tischen sitzen — bleiben sie beim
  selektiven Neumischen weiterhin zusammen (analog zur harten Regel bei
  der vollen Berechnung), oder ist das hier bewusst ein freieres
  Werkzeug ohne Gruppen-Garantie?
- Zuteilungsart (Zufällig/Elo-balanciert) beim Teil-Mischen: gleicher
  Modus wie bei der letzten vollen Berechnung, oder erneut wählbar?
- Wie werden die betroffenen Tische ausgewählt — Mehrfachauswahl per Tap
  auf die Tischkachel, ein Checkbox pro Tisch, o. ä.?
- Tischgrössen der ausgewählten Tische bleiben dabei unverändert (nur
  wer wo sitzt wird neu gewürfelt) — das dürfte unstrittig sein, aber
  zur Sicherheit beim Grillen bestätigen.
- Persistenz/öffentliche Anzeige: vermutlich wie beim manuellen Tausch
  heute schon (`persistCasualPairing`) sofort übernehmen.

**Nächster Schritt, wenn's angegangen wird:** Grill-Session zur
Tischauswahl-UI und zum Gruppen-Verhalten, bevor irgendwas gebaut wird.

## UI: "Tische berechnen"-Knopf auf Desktop zu weit weg

**Status:** Bekannte Nebenwirkung, noch nicht behoben.

**Worum es geht:** Die Mindesthöhe der Spielerliste in `CasualClient.tsx`
(`listMinHeight`, eingeführt in PR #5 gegen das Sprung-Problem beim
mobilen Suchen) reserviert bewusst Platz für die mobile 2-Spalten-Breite
als Worst Case. Auf Desktop-Breiten (`sm:grid-cols-3`) bleibt dadurch oft
unnötiger Leerraum zwischen der Liste und dem "Tische berechnen"-Knopf
darunter, weil die tatsächlichen 3 Spalten weniger Zeilen brauchen als
die reservierten 2-Spalten-Zeilen.

**Offen:**
- Reservierte Höhe an die tatsächliche Spaltenzahl anpassen (z. B. per
  `matchMedia`/`ResizeObserver` die aktuelle Spaltenzahl ermitteln), oder
  reicht ein einfacherer Ansatz (z. B. die Mindesthöhe nur unterhalb
  einer Breakpoint-Grenze per CSS statt inline-Style anwenden)?
- Betrifft nur Desktop/breite Viewports — der ursprüngliche Zoom-/Sprung-
  Fix für Mobile (PR #4/#5) bleibt unangetastet.

**Nächster Schritt, wenn's angegangen wird:** Kleiner, risikoarmer Fix —
vermutlich kein eigener Grill nötig, nur kurz verifizieren auf beiden
Breiten.

## Achievement-Tracking pro Liga-Abend und pro Spiel

**Status:** Idee, noch nicht ausgearbeitet.

**Worum es geht:** Aktuell (siehe SPEC.md Abschnitt 5) trägt der
Organisator nach jeder Runde nur die **Gesamtpunktsumme** pro Spieler
ein — das vollständige Achievement-Sheet der Saison-Liga (25
Achievements pro Abend, siehe
https://mtgbl.ch/liga/commander/2026/achievements — u. a. Teilnahme,
Sieg, erste Eliminierung, Deckbau- und rotierende Achievements) wird
bewusst **nicht** digital abgebildet (siehe SPEC.md Abschnitt 9).

Wunsch: alle Achievements einzeln erfassen können — pro Liga-Abend und
pro Spiel (nicht nur die Summe) — und bei den Spielern hinterlegen, statt
nur den fortlaufenden Gesamtpunktestand zu pflegen.

**Offen:**
- UI-Konzept fehlt noch komplett ("muss grundsätzlich noch über das UI
  nachdenken") — 25 Achievements pro Abend sind viel für eine
  Erfassungsmaske, gerade mobil.
- Datenmodell: heutiges Schema kennt nur `pointsAwarded` pro
  `TableAssignment` (siehe `prisma/schema.prisma`), kein Feld für
  einzelne Achievements.
- Wie bildet man die 25 Achievements der Saison-Rangliste ab — fest im
  Code, oder als konfigurierbare Liste? Ändern sie sich saisonweise?
- Verhältnis zur bestehenden Gesamtpunktsumme: ersetzt die
  Achievement-Erfassung die manuelle Punkteeingabe (Summe wird daraus
  berechnet), oder laufen beide parallel?
- Betrifft nur die Liga — die laut Handover aktuell ohnehin nicht aktiv
  weiterentwickelt wird (Fokus liegt auf Casual).

**Nächster Schritt, wenn's angegangen wird:** Grill-Session zu
Datenmodell und UI, bevor irgendwas gebaut wird.

## Casual-Zuteilung überlebt Reload der Admin-Seite

**Status:** Fertig gegrillt, bereit zur Umsetzung ohne weitere Rückfragen.

**Problem:** `/admin/casual` vergisst die zuletzt berechnete
Tischzuteilung bei einem Reload — nur Auswahl+Gruppen überleben aktuell
(via `localStorage`, siehe PR #4), nicht die Tische selbst. Dabei liegt
die Zuteilung in der DB (`casual_seats`) längst persistent, nur die
Admin-Seite liest sie beim Laden bisher nicht.

**Ursprünglicher Wunsch** ("Cookie für 1 Tag") wurde beim Grillen zu
folgendem Design verfeinert:

- **Kein Cookie** — Single-User-App, es gibt keinen Grund für eine
  zweite Quelle der Wahrheit neben der DB. Stattdessen liest die
  Server-Komponente `src/app/admin/(dashboard)/casual/page.tsx` beim
  Laden die aktuelle Zuteilung über `getCasualPairing()`
  (`src/lib/casualPairing.ts`) und übergibt sie als Startzustand an
  `CasualClient` (neue Prop, z. B. `initialPairing`).
- **1-Tag-Frist** läuft ab `createdAt` der `casual_seats`-Zeilen (Feld
  existiert bereits, alle Zeilen einer Zuteilung teilen denselben
  Zeitstempel, da `saveCasualPairing()` sie in einer Transaktion per
  `createMany` anlegt). Ist die Zuteilung älter als 1 Tag, wird sie beim
  Laden **nicht** automatisch angezeigt (Startzustand bleibt `null`,
  wie heute) — der Organisator müsste neu auswählen/berechnen.
- **Nach Ablauf betrifft das ausschliesslich diese Admin-Auto-Anzeige.**
  Die DB-Zeilen bleiben unangetastet, die öffentliche Seite zeigt die
  Zuteilung weiterhin unbegrenzt, bis sie manuell zurückgesetzt oder ein
  Liga-Abend gestartet wird — daran ändert sich nichts.
- **Neu berechnen** ersetzt die Zuteilung wie gewohnt (bestehende
  `saveCasualPairing()`-Logik, unverändert).
- **Keine Schema-Änderung, keine Migration** — `createdAt` existiert
  bereits.
- `skillLevel` in `TableResultPlayer` wird in der Tischanzeige aktuell
  nirgends gerendert (verifiziert) — für den aus der DB
  wiederhergestellten Zustand reicht ein Platzhalterwert (0), es muss
  dafür nichts zusätzlich aus der DB geladen werden.
- Gruppen-Kürzel auf den wiederhergestellten Tischkacheln ergeben sich
  automatisch aus dem ohnehin unabhängig aus `localStorage` geladenen
  Gruppen-Zustand — keine zusätzliche Verdrahtung nötig.

**Nächster Schritt, wenn's angegangen wird:** Direkt umsetzen (Branch,
Anpassung in `page.tsx` + `CasualClient.tsx`, lokal mit einer frischen
und einer künstlich auf >1 Tag zurückdatierten Zuteilung verifizieren),
PR wie gewohnt — kein erneutes Grillen nötig.
