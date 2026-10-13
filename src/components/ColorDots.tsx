import { colorsOf, COLOR_NAMES, type Color } from "@/lib/colorIdentity";

const DOT_COLORS: Record<Color, string> = {
  W: "bg-amber-100",
  U: "bg-blue-500",
  B: "bg-neutral-900 ring-1 ring-white/60",
  R: "bg-red-500",
  G: "bg-green-500",
};

/**
 * Farbidentität als farbige Punkte in den Magic-Farben (SPEC.md Abschnitt
 * 13) — in der Rangliste und in der Spielerverwaltung.
 */
export default function ColorDots({
  identity,
  size = "h-2 w-2",
}: {
  identity: string | null;
  size?: string;
}) {
  const colors = colorsOf(identity);
  if (colors.length === 0) return null;
  const label = colors.map((c) => COLOR_NAMES[c]).join(", ");
  return (
    <span className="flex shrink-0 gap-0.5" title={label} aria-label={`Farben: ${label}`} role="img">
      {colors.map((c) => (
        <span key={c} className={`${size} rounded-full ${DOT_COLORS[c]}`} />
      ))}
    </span>
  );
}
