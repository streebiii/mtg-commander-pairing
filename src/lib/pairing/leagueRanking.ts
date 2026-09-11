/**
 * Rangfolge für die Liga-Paarung (siehe SPEC.md Abschnitt 5.1).
 *
 * Sortiert wird **nicht** nach der Gesamtpunktzahl der offiziellen
 * Rangliste, sondern nach Punkten **pro besuchtem Abend**. Grund: die
 * Gesamtsumme misst zu einem guten Teil Anwesenheit statt Stärke. Im Stand
 * nach drei Abenden 2026 stand etwa David mit 11 Punkten auf Platz 23 —
 * aus einem einzigen besuchten Abend, an dem er mehr geholt hat als die
 * Hälfte des Feldes im Schnitt. Nach Gesamtpunkten zu paaren hätte ihn an
 * den letzten Tisch gesetzt, und weil dieselben Leute regelmässig fehlen,
 * säßen am unteren Ende jeden Abend dieselben zusammen.
 *
 * Die offizielle Wertung auf mtgbl.ch bleibt davon unberührt — dort zählt
 * weiterhin die Gesamtsumme. Hier geht es allein um die Sitzordnung.
 */

/**
 * Wie viele fiktive Abende zum Ligadurchschnitt jedem Spieler
 * gutgeschrieben werden, bevor sein Schnitt gebildet wird.
 *
 * Ohne diese Dämpfung würde ein einzelner guter Abend jemanden weit nach
 * oben heben — bei einer einzigen Messung ist der Schnitt schlicht nicht
 * belastbar. Mit zwei Vorschuss-Abenden zählt ein Spieler mit einem
 * Abend zu einem Drittel sich selbst und zu zwei Dritteln als
 * Durchschnitt; wer alle Abende dabei war, spürt die Dämpfung kaum noch.
 */
export const DAEMPFUNG_ABENDE = 2;

/**
 * Zufalls-Rauschen auf den Rangplatz, in Rängen.
 *
 * Der Regler gegen "immer dieselben Gegner". Gemessen über eine Saison mit
 * 28 Spielern: ohne Rauschen sitzt man mit seinem häufigsten Gegner 9 von
 * 12 Zuteilungen zusammen, bei ±10 nur noch 4,5, und man trifft 17,9 statt
 * 12,8 verschiedene Leute. Der Preis sind rund fünf Begegnungen pro Saison
 * zwischen oberem und unterem Viertel — bewusst in Kauf genommen.
 *
 * Auf ±7 reduziert (vorher ±10), nachdem in der Praxis Rang 1 und Rang 16
 * zusammensassen — ein Abstand von 15, innerhalb der tatsächlichen
 * Durchmischungsgrenze von 2×RANG_RAUSCHEN. Mit ±7 liegt diese Grenze bei
 * 14 Rängen statt 20. Kein hartes Limit — nur seltener und kleiner als
 * zuvor (siehe BACKLOG.md für die verworfene Alternative mit zusätzlicher
 * harter Abstandsgrenze).
 */
export const RANG_RAUSCHEN = 7;

/**
 * Wie viele Ränge ein Rundensieg für die Paarung der zweiten Runde zählt.
 *
 * Bewusst endlich: ein Sieg soll heben, aber nicht an die Spitze
 * katapultieren. Wer an einem der hinteren Tische gewinnt, trifft in
 * Runde 2 auf die Sieger seiner Umgebung, nicht auf die Ligaspitze.
 */
export const SIEG_BONUS_RAENGE = 3;

/**
 * Wie weit zwei Spieler im Rang auseinanderliegen dürfen, damit die
 * Rematch-Vermeidung sie tauschen darf (siehe `assignLeagueRound`).
 */
export const TAUSCH_TOLERANZ_RAENGE = 4;

export interface LeaguePlayerStanding {
  id: string;
  points: number;
  attendedEvenings: number;
}

/**
 * Durchschnittliche Punkte pro Spieler und Abend über das ganze Feld.
 * Liefert 0, wenn niemand einen besuchten Abend hinterlegt hat — dann
 * fällt der gedämpfte Schnitt auf eine reine Division der Gesamtpunkte
 * zurück und die Reihenfolge entspricht wieder der Rangliste.
 */
export function leagueAverage(players: readonly LeaguePlayerStanding[]): number {
  const abende = players.reduce((s, p) => s + Math.max(0, p.attendedEvenings), 0);
  if (abende === 0) return 0;
  return players.reduce((s, p) => s + p.points, 0) / abende;
}

/** Gedämpfter Punkteschnitt eines Spielers. */
export function dampedAverage(
  player: LeaguePlayerStanding,
  ligaSchnitt: number,
): number {
  const abende = Math.max(0, player.attendedEvenings);
  return (
    (player.points + DAEMPFUNG_ABENDE * ligaSchnitt) / (abende + DAEMPFUNG_ABENDE)
  );
}

/**
 * Übersetzt die Spieler in Sortierwerte für `assignLeagueRound`.
 *
 * Der Wert ist der **negative Rangplatz** (0 = bester Spieler), damit das
 * Rauschen und der Sieg-Bonus in Rängen gerechnet werden können und nicht
 * in Punkten: Punktabstände sind in der Rangliste extrem ungleich verteilt
 * — an der Spitze liegen 4 bis 6 Punkte zwischen den Plätzen, im
 * Mittelfeld oft null. Ein Regler in Punkten würde deshalb oben fast nichts
 * und in der Mitte sehr viel bewegen.
 *
 * @param sieger IDs der Spieler, die ihre letzte Runde gewonnen haben.
 *   Sie bekommen `SIEG_BONUS_RAENGE` gutgeschrieben.
 */
export function rankValues(
  players: readonly LeaguePlayerStanding[],
  sieger: ReadonlySet<string> = new Set(),
): { id: string; points: number }[] {
  const ligaSchnitt = leagueAverage(players);
  const sortiert = [...players].sort(
    (a, b) => dampedAverage(b, ligaSchnitt) - dampedAverage(a, ligaSchnitt),
  );
  return sortiert.map((p, position) => ({
    id: p.id,
    points: -position + (sieger.has(p.id) ? SIEG_BONUS_RAENGE : 0),
  }));
}
