import { formatPlayerName } from "@/lib/players";

export interface MatchablePlayer {
  firstName: string;
  lastName: string | null;
}

/** Vergleichbar machen: Kleinschreibung, ohne Punkte, einfache Leerzeichen. */
function norm(text: string): string {
  return text.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/**
 * Findet zu einem Namen, wie ihn mtgbl.ch führt («Anna S.», «Fiona»,
 * «Anna Sommerfeld.»), die passenden Spieler der App. Zuerst der ganze Name
 * (ohne Punkte), sonst Vorname gleich und Nachname beginnt mit dem
 * Kürzel — «Anna S.» passt also zu «Anna Stalder». Steht nur ein Vorname
 * da, zählt jeder mit diesem Vornamen.
 *
 * Gibt alle Treffer zurück; eindeutig ist der Name nur bei genau einem.
 * Aufrufer entscheiden, was bei keinem oder mehreren passiert.
 */
export function matchPlayerName<T extends MatchablePlayer>(name: string, players: readonly T[]): T[] {
  const wanted = norm(name);
  const exact = players.filter((p) => norm(formatPlayerName(p)) === wanted);
  if (exact.length > 0) return exact;

  const [first, ...rest] = wanted.split(" ");
  const last = rest.join(" ");
  return players.filter(
    (p) => norm(p.firstName) === first && (!last || norm(p.lastName ?? "").startsWith(last)),
  );
}
