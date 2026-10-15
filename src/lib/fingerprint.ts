import { createHash } from "node:crypto";

/**
 * Kurzer Fingerabdruck eines Werts. Offene Seiten fragen ihn ab und laden
 * nur neu, wenn er sich geändert hat (components/AutoRefresh.tsx).
 */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
