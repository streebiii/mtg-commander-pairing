import { fingerprint } from "@/lib/fingerprint";
import type { SheetData } from "@/lib/entries";

/** Fingerabdruck des Blatts, das dieses Gerät gerade sieht. */
export function deviceSheetVersion(
  sheet: SheetData,
  winnerNotes: Record<number, string | null>,
): string {
  return fingerprint({ sheet, winnerNotes });
}
