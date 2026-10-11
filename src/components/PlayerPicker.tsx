"use client";

import { useMemo, useState, type CSSProperties, type ReactNode, type Ref } from "react";

/**
 * Bausteine der Anwesenheits-Auswahl, gemeinsam für Casual und Liga
 * (siehe SPEC.md Abschnitt 4): eine stabil alphabetische Liste, ein
 * Suchfeld, das live filtert, und Enter als Abkürzung für den einzigen
 * Treffer. Was ein Tap bewirkt, entscheidet der Aufrufer.
 */

interface NamedPlayer {
  id: string;
  name: string;
}

/**
 * Suche über eine Spielerliste. Die Suche filtert alle Einträge gleich,
 * unabhängig von der Auswahl — ein Tap ändert nur den Zustand eines
 * Eintrags, nie seine Position.
 */
export function usePlayerSearch<T extends NamedPlayer>(players: readonly T[]) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [sorted, search]);

  // Nur bei nicht-leerer Suche: sonst leuchtete die Kachel auch bei leerem
  // Feld auf, sobald es nur einen einzigen Spieler gibt.
  const searchActive = search.trim().length > 0;

  return {
    search,
    setSearch,
    sorted,
    filtered,
    /** Wen ein Enter gerade träfe — genau ein Treffer. */
    enterTarget: searchActive && filtered.length === 1 ? filtered[0] : null,
    /** Kein Treffer: Enter legt (wo möglich) einen neuen Spieler an. */
    noMatch: searchActive && filtered.length === 0,
  };
}

export function PlayerSearchField({
  value,
  onChange,
  onEnter,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      Spieler suchen
      <input
        type="text"
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          onEnter();
        }}
        placeholder="Name eingeben…"
        className="min-h-9 w-full max-w-sm rounded border border-white/20 px-3 py-2"
      />
    </label>
  );
}

// Entsprechen `min-h-11` und `gap-2` der Kacheln unten.
const ROW_HEIGHT = 44;
const ROW_GAP = 8;

function gridHeight(count: number, columns: number): string {
  const rows = Math.ceil(count / columns);
  return `${rows > 0 ? rows * ROW_HEIGHT + (rows - 1) * ROW_GAP : 0}px`;
}

/**
 * Raster der Spielerkacheln. Reserviert die Höhe für den vollen
 * (ungefilterten) Bestand — sonst schrumpft die Seite bei jedem
 * Tastendruck im Suchfeld mit der Trefferzahl und die Ansicht springt.
 * Die Spaltenzahl wechselt per CSS an denselben Breakpoints wie die
 * reservierte Höhe, ohne Messen in JavaScript.
 */
export function PlayerTileGrid({
  totalCount,
  children,
}: {
  totalCount: number;
  children: ReactNode;
}) {
  return (
    <div
      className="grid min-h-[var(--h-mobile)] grid-cols-2 content-start gap-2 sm:min-h-[var(--h-sm)] sm:grid-cols-3 xl:min-h-[var(--h-xl)] xl:grid-cols-4"
      style={
        {
          "--h-mobile": gridHeight(totalCount, 2),
          "--h-sm": gridHeight(totalCount, 3),
          "--h-xl": gridHeight(totalCount, 4),
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Eine Spielerkachel. `pending` (amber) markiert die entstehende Gruppe
 * im Casual-Tab; der Ring für das Enter-Ziel legt sich über den
 * jeweiligen Zustand, statt ihn zu ersetzen, und das ↵ sorgt dafür, dass
 * die Markierung nicht allein an der Farbe hängt.
 */
export function PlayerTile({
  name,
  selected,
  pending = false,
  enterTarget,
  detail,
  badge,
  disabled,
  onClick,
}: {
  name: string;
  selected: boolean;
  pending?: boolean;
  enterTarget: boolean;
  /** Zusatz hinter dem Namen, z.B. der Punktestand in der Liga. */
  detail?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex min-h-11 w-full items-center gap-1.5 rounded border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
        pending
          ? "border-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
          : selected
            ? "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
            : "border-white/10 hover:bg-white/5"
      } ${enterTarget ? "ring-2 ring-foreground/60" : ""}`}
    >
      <span className="w-4 shrink-0">{selected ? "✓" : ""}</span>
      <span className="truncate flex-1">
        {name}
        {detail !== undefined && <span className="opacity-60"> {detail}</span>}
      </span>
      {enterTarget && (
        <span
          aria-hidden="true"
          className="shrink-0 text-xs opacity-70"
          title="Enter wählt diesen Spieler aus"
        >
          ↵
        </span>
      )}
      {badge}
    </button>
  );
}
