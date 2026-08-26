# Backlog

Ideen und zukünftige Vorhaben, die noch nicht spruchreif genug für einen
Grill (`/mattpocock-skills:grill-me`) sind. Grob gehalten mit Absicht —
Ausarbeitung passiert erst, wenn ein Eintrag tatsächlich angegangen wird.

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

## Casual: Beschreibungstext raus, dafür Info-Knopf

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Unter der Überschrift "Casual" steht aktuell (siehe
`src/app/admin/(dashboard)/casual/page.tsx`):

> Spieler auswählen · Tische auswürfeln · fertig. Eine Runde, keine
> Punkte, kein Verlauf.

Dieser Text soll **komplett verschwinden**. Stattdessen kommt neben die
Überschrift ein **Info-Knopf**, der die Funktionen des Tabs erklärt.

Begründung: Im Alltag weiss der Organisator, was der Modus tut — der
Dauertext kostet nur Platz. Wer die Erklärung braucht, holt sie sich
gezielt.

**Was die Erklärung abdecken sollte:** Spieler auswählen und suchen,
neuen Spieler erfassen, Gruppe bilden, Zuteilungsart (Zufällig vs.
Ausgewogen), Tische berechnen inkl. sofortiger öffentlicher Sichtbarkeit,
nachträgliches Tauschen zweier Spieler, selektives Neumischen einzelner
Tische, Zurücksetzen.

**Zu beachten bei der Umsetzung:**
- Kein `window.alert` — liefert in eingebetteten Browser-Ansichten keinen
  Dialog (siehe Bugfix beim Löschen). Also aufklappbarer Abschnitt oder
  Overlay direkt in der Seite.
- `page.tsx` ist eine Server-Komponente; der Knopf braucht Zustand, also
  eine kleine Client-Komponente daneben.
- Knopf mit 44px Klickfläche und `aria-expanded`/`aria-label`, wie die
  übrigen Icon-Knöpfe.

**Nächster Schritt:** Direkt umsetzen, kein erneutes Grillen nötig.

## Casual: die beiden Spalten visuell trennen

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Auf dem Desktop stehen im Casual-Tab die Auswahl
(links, 3 Spalten) und die Einstellungen (rechts, 1 Spalte) ohne jede
optische Grenze nebeneinander. Die rechte Spalte soll sich absetzen —
gewünscht ist ein **leicht helleres Schwarz** als der Seitenhintergrund.

**Zu beachten bei der Umsetzung:**
- Am saubersten als eigenes Token neben `--background` in
  `src/app/globals.css`, statt eine Farbe fest in die Komponente zu
  schreiben.
- **Reihenfolge beachten:** am besten erst den Eintrag "Hellmodus
  komplett entfernen" umsetzen. Danach gibt es nur noch einen
  Hintergrund, gegen den sich das hellere Schwarz absetzen muss — sonst
  braucht es zusätzlich ein Gegenstück für den Hellmodus, das gleich
  wieder wegfällt.
- Die rechte Spalte (`<aside>` in `CasualClient.tsx`) ist sticky und
  `calc(100vh-3rem)` hoch. Eine Hintergrundfläche wird dadurch zu einem
  hohen Panel, das beim Scrollen stehen bleibt — vermutlich mit
  Innenabstand und abgerundeten Ecken sinnvoller als randlos.
- Unterhalb von `lg` stapeln die Spalten. Dort sollte die Fläche
  entweder ebenfalls sauber aussehen oder auf Desktop beschränkt bleiben.

**Nächster Schritt:** Direkt umsetzen, in beiden Layouts (gestapelt und
zweispaltig) gegenprüfen.

## Hellmodus komplett entfernen — App ist immer dunkel

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Die App unterstützt aktuell beide Farbmodi und folgt
der Systemeinstellung (`prefers-color-scheme` in
`src/app/globals.css`). Gewünscht ist stattdessen **durchgehend dunkel**,
unabhängig davon, was das Gerät eingestellt hat. Der Hellmodus fällt
ersatzlos weg.

**Was dazugehört:**
- `globals.css`: `--background`/`--foreground` fest auf die dunklen Werte
  (`#0a0a0a` / `#ededed`), den `@media (prefers-color-scheme: dark)`-Block
  auflösen.
- `<html>` in `src/app/layout.tsx` bekommt `color-scheme: dark`, damit
  Browser-Bedienelemente (Scrollbalken, Auswahlfelder, Datumsfelder)
  ebenfalls dunkel rendern statt hell zu bleiben.
- Die rund **47 `dark:`-Varianten in 12 Dateien** werden dadurch
  überflüssig: `border-black/20 dark:border-white/20` wird schlicht
  `border-white/20`. Aufräumen, sonst bleibt toter Ballast stehen, der
  suggeriert, es gäbe noch einen zweiten Modus.
- **Ausnahme prüfen:** das Vereinslogo auf der öffentlichen Seite trägt
  `dark:invert` (`src/app/page.tsx`) — der Bär ist schwarz auf
  transparentem Grund und braucht die Invertierung, damit er auf dunklem
  Hintergrund sichtbar ist. Diese eine Stelle wird zu einem festen
  `invert`, nicht einfach gestrichen.

**Zu beachten:** Betrifft auch die öffentliche Pairing-Seite, nicht nur
den Organisator-Bereich.

**Nächster Schritt:** Direkt umsetzen, danach alle Seiten einmal
durchklicken — inklusive Formularfeldern und der öffentlichen Seite.

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
