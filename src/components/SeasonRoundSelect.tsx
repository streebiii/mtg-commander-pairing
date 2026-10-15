import { EVENINGS_PER_SEASON } from "@/lib/season";

/** Wert der Auswahl für «Testrunde — zählt nicht». */
export const TEST_EVENING = "test";

/** Vorbelegung aus der aus dem Datum abgeleiteten Spalte. */
export function initialSeasonRound(suggestedRound: number | null): string {
  return suggestedRound === null ? TEST_EVENING : String(suggestedRound);
}

/** Auswahlwert → Spalte; null heisst Testrunde. */
export function parseSeasonRound(value: string): number | null {
  return value === TEST_EVENING ? null : Number(value);
}

/**
 * Die Frage «Zählt in der Rangliste als R1–R6 oder Testrunde» — beim
 * Schliessen einer Erfassung, in der Ligaverwaltung wie beim Start der
 * nächsten Runde (SPEC.md Abschnitt 12.3).
 */
export default function SeasonRoundSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-base">
      Zählt in der Rangliste als
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-h-9 w-fit max-w-full rounded border border-white/20 bg-transparent px-3 py-2"
      >
        {Array.from({ length: EVENINGS_PER_SEASON }, (_, i) => i + 1).map((r) => (
          <option key={r} value={r}>
            R{r}
          </option>
        ))}
        <option value={TEST_EVENING}>Testrunde — zählt nicht</option>
      </select>
    </label>
  );
}
