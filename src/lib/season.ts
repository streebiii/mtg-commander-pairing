// Termine der Commander-Liga 2026 laut https://mtgbl.ch/liga/commander/uebersicht.
// Daraus leitet die App ab, der wievielte Liga-Abend ein Abend ist
// (R1–R6) — und damit, ob es der letzte der Saison ist, an dem
// «1x am Ende der Liga»-Achievements wie Evergreen zählen. Eine eigene
// Saison-Verwaltung gibt es noch nicht (siehe BACKLOG.md); bei einer
// Terminverschiebung muss diese Liste angepasst werden.
export const SEASON_2026_DATES = [
  "2026-04-24",
  "2026-05-22",
  "2026-08-14",
  "2026-09-11",
  "2026-10-16",
  "2026-11-06",
] as const;

export const EVENINGS_PER_SEASON = SEASON_2026_DATES.length;

/** Kalendertag in Schweizer Zeit als "YYYY-MM-DD". */
function zurichDay(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
  }).format(date);
}

/**
 * Nummer des Liga-Abends (1–6) zu einem Datum: der letzte Termin, der am
 * oder vor diesem Tag liegt. Ein Testabend vor dem ersten Termin ergibt 1.
 *
 * Ab dem übernächsten Tag nach dem letzten Termin ist die Saison vorbei —
 * dann `null` (ein Tag Spielraum für einen Abend über Mitternacht). Sonst
 * zählte jeder spätere Abend (auch einer der nächsten Saison, solange
 * diese Liste nicht nachgeführt ist) als letzter Abend, und Evergreen
 * erschiene jedes Mal.
 */
export function eveningNumber(date: Date): number | null {
  const day = zurichDay(date);
  const dayBefore = zurichDay(new Date(date.getTime() - 24 * 60 * 60 * 1000));
  if (dayBefore > SEASON_2026_DATES[SEASON_2026_DATES.length - 1]) return null;
  let number = 1;
  SEASON_2026_DATES.forEach((d, i) => {
    if (d <= day) number = i + 1;
  });
  return number;
}

export function isLastEvening(date: Date): boolean {
  return eveningNumber(date) === EVENINGS_PER_SEASON;
}

/** "Liga-Abend 3" — oder ohne Nummer, wenn der Abend ausserhalb der Saison liegt. */
export function eveningLabel(date: Date): string {
  const number = eveningNumber(date);
  return number === null ? "Liga-Abend (ausserhalb der Saison)" : `Liga-Abend ${number}`;
}
