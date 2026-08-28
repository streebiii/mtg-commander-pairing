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
  auflösen. Dasselbe gilt für `--surface` (die abgesetzte Fläche der
  rechten Casual-Spalte): der helle Wert `#f4f4f5` fällt weg, `#161616`
  bleibt.
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

## Casual: den Enter-Treffer in der Suche hervorheben

**Status:** Klar, kein Grill nötig.

**Worum es geht:** Enter im Suchfeld wählt den Spieler aus, wenn die
Suche genau einen Treffer übrig lässt (siehe SPEC.md Abschnitt 4). Man
sieht der Liste aber nicht an, dass dieser eine Eintrag jetzt "scharf"
ist — die Kachel sieht aus wie jede andere. Gewünscht ist eine sichtbare
Hervorhebung des letzten verbliebenen Treffers, damit vor dem Tastendruck
klar ist, wen es trifft.

**Zu beachten bei der Umsetzung:**
- Bedingung ist `filteredPlayers.length === 1` **und** ein nicht-leerer
  Suchtext (`src/app/admin/(dashboard)/casual/CasualClient.tsx`). Ohne die
  zweite Bedingung leuchtete die Kachel auch bei leerem Suchfeld auf,
  sobald der Verein nur einen einzigen Spieler hat.
- Die Kacheln haben bereits drei Zustände: Gruppen-Kandidat (amber),
  ausgewählt (blau) und neutral. Ein vierter Rahmen in einer vierten Farbe
  wird unleserlich — besser ein zusätzlicher `ring`/Outline, der sich mit
  den bestehenden Zuständen überlagern darf, statt sie zu ersetzen.
- Nicht allein über Farbe: ein kleines `↵` auf der Kachel sagt auch dann,
  was passieren wird, wenn jemand die Farben nicht unterscheiden kann.
- **Gegenstück nicht vergessen:** bei *null* Treffern ist der Knopf
  „+ „{Suchtext}" als neuen Spieler anlegen" das Enter-Ziel. Der sollte
  dieselbe Hervorhebung bekommen, sonst wirkt die Logik willkürlich.
- Ein bereits ausgewählter Spieler bleibt Enter-Ziel, obwohl Enter dann
  bewusst nichts tut (kein Abwählen, siehe SPEC.md Abschnitt 4). Entweder
  die Hervorhebung in dem Fall weglassen oder sie klar anders aussehen
  lassen als bei einem noch nicht ausgewählten Spieler.

**Nächster Schritt:** Direkt umsetzen.
