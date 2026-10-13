import { describe, expect, it } from "vitest";
import { decklistHost, normalizeDecklistUrl } from "./decklist";

describe("normalizeDecklistUrl", () => {
  it("übernimmt https-Adressen", () => {
    expect(normalizeDecklistUrl("https://moxfield.com/decks/abc")).toBe("https://moxfield.com/decks/abc");
  });

  it("ergänzt https:// bei Adressen ohne Schema", () => {
    expect(normalizeDecklistUrl("  archidekt.com/decks/123 ")).toBe("https://archidekt.com/decks/123");
  });

  it("macht aus einem leeren Feld «keine Deckliste»", () => {
    expect(normalizeDecklistUrl("   ")).toBeNull();
    expect(normalizeDecklistUrl(null)).toBeNull();
  });

  it("lehnt andere Schemata und Unsinn ab", () => {
    expect(normalizeDecklistUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeDecklistUrl("data:text/html,hi")).toBeUndefined();
    expect(normalizeDecklistUrl("ftp://example.com/deck")).toBeUndefined();
    expect(normalizeDecklistUrl("keine adresse")).toBeUndefined();
  });
});

describe("decklistHost", () => {
  it("zeigt den Host ohne www", () => {
    expect(decklistHost("https://www.moxfield.com/decks/abc")).toBe("moxfield.com");
  });
});
