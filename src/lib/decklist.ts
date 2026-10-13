/**
 * Link zur Deckliste eines Spielers (SPEC.md Abschnitt 13.1). Erlaubt sind
 * nur http(s)-Adressen — sonst liesse sich über das Feld z.B. ein
 * `javascript:`-Link in die öffentliche Rangliste schleusen. Ohne Schema
 * eingegebene Adressen («moxfield.com/decks/…») bekommen https://.
 *
 * @returns die bereinigte Adresse, null für «keine Deckliste» (leeres
 *   Feld) oder undefined, wenn die Eingabe keine gültige Adresse ist.
 */
export function normalizeDecklistUrl(raw: string | null | undefined): string | null | undefined {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (!url.hostname.includes(".")) return undefined;
  return url.toString();
}

/** Kurzform für die Anzeige: «moxfield.com» statt der ganzen Adresse. */
export function decklistHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
