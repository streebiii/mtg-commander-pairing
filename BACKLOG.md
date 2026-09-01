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
