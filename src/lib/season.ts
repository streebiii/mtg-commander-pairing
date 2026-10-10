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
 */
export function eveningNumber(date: Date): number {
  const day = zurichDay(date);
  let number = 1;
  SEASON_2026_DATES.forEach((d, i) => {
    if (d <= day) number = i + 1;
  });
  return number;
}

export function isLastEvening(date: Date): boolean {
  return eveningNumber(date) === EVENINGS_PER_SEASON;
}
