import type { ReactNode } from "react";

const TONES = {
  default: "border-white/20",
  /** Für das Neumischen ausgewählt (Casual). */
  selected: "border-blue-500 bg-blue-500/5",
  /** Wartet auf eine Eingabe, z.B. den Sieger (Liga). */
  attention: "border-amber-500/60",
} as const;

/**
 * Ein Tisch im Organisator-Bereich — Casual und Liga zeigen ihre
 * Zuteilungen im selben Rahmen. Der Inhalt (Spielerliste, Knöpfe) kommt
 * vom Aufrufer.
 *
 * Mit `onTitleClick` wird die Kopfzeile zum Knopf (Casual: Tisch fürs
 * Neumischen auswählen). `aside` steht rechts in der Kopfzeile, z.B. ein
 * Status.
 */
export default function TableCard({
  tableNumber,
  size,
  tone = "default",
  aside,
  onTitleClick,
  children,
}: {
  tableNumber: number;
  size: number;
  tone?: keyof typeof TONES;
  aside?: ReactNode;
  onTitleClick?: () => void;
  children: ReactNode;
}) {
  const header = (
    <>
      <span>
        Tisch {tableNumber} ({size} Spieler)
      </span>
      {aside && <span className="shrink-0 text-xs font-normal">{aside}</span>}
    </>
  );

  return (
    <div className={`w-full rounded border p-3 sm:w-60 ${TONES[tone]}`}>
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          className="mb-2 flex min-h-11 w-full items-center justify-between gap-2 rounded text-left text-sm font-semibold"
        >
          {header}
        </button>
      ) : (
        <div className="mb-2 flex min-h-11 items-center justify-between gap-2 text-sm font-semibold">
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
