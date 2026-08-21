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
