"use client";

import type { AchievementCategory, AchievementScope } from "@prisma/client";
import { useMemo, useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import {
  CATEGORIES,
  SCOPES,
  SCOPE_LABELS,
  formatPoints,
} from "@/lib/achievements";
import { updateAchievement } from "./actions";
import NewAchievementPanel from "./NewAchievementPanel";

export interface TableAchievement {
  id: string;
  title: string;
  description: string;
  points: number;
  category: AchievementCategory;
  scope: AchievementScope;
  active: boolean;
  sortOrder: number;
}

type Editable = Pick<
  TableAchievement,
  "title" | "description" | "points" | "scope" | "active"
>;
type Column = "title" | "description" | "scope" | "points";
type SortKey = "default" | "title" | "scope" | "points";
type StatusFilter = "active" | "inactive" | "all";

/** Reiter-Beschriftung je Kategorie. */
const TAB_LABELS: Record<AchievementCategory, string> = {
  FIXED: "Fix",
  DECKBUILDING: "Deckbau",
  ROTATING: "Rotierend",
};

const collator = new Intl.Collator("de-CH", { sensitivity: "base" });

/** Eingabefelder bleiben bei 16px (iOS-Zoom, siehe globals.css). */
const CELL_INPUT =
  "block w-full bg-background px-3 py-2.5 outline-none ring-2 ring-inset ring-blue-500";

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 ${direction ? "opacity-100" : "opacity-30"}`}
      fill="currentColor"
    >
      {direction !== "desc" && <path d="M6 2 9.5 6h-7z" />}
      {direction !== "asc" && <path d="M6 10 2.5 6h7z" />}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="m14 14 4 4" />
    </svg>
  );
}

/**
 * Editor einer angeklickten Zelle. Enter oder Verlassen speichert, Esc
 * verwirft. In der Beschreibung fügt Shift+Enter einen Zeilenumbruch ein.
 */
function CellEditor({
  column,
  initial,
  onCommit,
  onCancel,
}: {
  column: Column;
  initial: Editable;
  onCommit: (patch: Partial<Editable>) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(() =>
    column === "points" ? String(initial.points) : String(initial[column]),
  );
  // Verhindert ein zweites Speichern durch das Blur nach Enter bzw. Esc.
  const done = useRef(false);

  function commit(value: string) {
    if (done.current) return;
    done.current = true;
    if (column === "title") {
      const title = value.trim();
      if (title && title !== initial.title) onCommit({ title });
      else onCancel();
    } else if (column === "description") {
      const description = value.trim();
      if (description !== initial.description) onCommit({ description });
      else onCancel();
    } else if (column === "points") {
      const points = Number.parseInt(value, 10);
      if (Number.isFinite(points) && points !== initial.points) {
        onCommit({ points });
      } else onCancel();
    } else {
      const scope = value as AchievementScope;
      if (scope !== initial.scope) onCommit({ scope });
      else onCancel();
    }
  }

  function cancel() {
    if (done.current) return;
    done.current = true;
    onCancel();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit(text);
    }
  }

  if (column === "scope") {
    const options = SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s] }));
    return (
      <select
        autoFocus
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={cancel}
        onKeyDown={onKeyDown}
        aria-label="Art"
        className={CELL_INPUT}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column === "description") {
    return (
      <textarea
        autoFocus
        rows={Math.max(2, text.split("\n").length)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Beschreibung"
        className={CELL_INPUT}
      />
    );
  }

  return (
    <input
      autoFocus
      type={column === "points" ? "number" : "text"}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => commit(text)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={column === "points" ? "Punkte" : "Titel"}
      className={`${CELL_INPUT} ${column === "points" ? "text-right tabular-nums" : ""}`}
    />
  );
}

/**
 * Katalog als drei Tabellen (fix, Deckbau, rotierend), umgeschaltet über
 * Reiter mit Anzahl — angelehnt an CRM-Listen: Werkzeugleiste mit Suche,
 * Art- und Status-Filter, sortierbare Spalten und Inline-Bearbeitung.
 * Ein Klick (oder Enter) auf eine Zelle macht sie zum Eingabefeld; Enter
 * oder Verlassen speichert, Esc verwirft. Gespeicherte Werte erscheinen
 * sofort, ohne auf die Server-Antwort zu warten.
 *
 * Die Status-Spalte ist ein Schalter: aktiv heisst «gilt am nächsten
 * Liga-Abend». Bei den rotierenden werden so nach jeder Ziehung die neuen
 * 10 aktiv gestellt. Die Reihenfolge bleibt beim Umschalten stehen
 * (Standard wie auf mtgbl.ch), damit Zeilen nicht unter dem Finger
 * wegspringen; inaktive sind abgeblendet.
 */
export default function AchievementTable({
  achievements,
}: {
  achievements: TableAchievement[];
}) {
  const [tab, setTab] = useState<AchievementCategory>("FIXED");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<AchievementScope | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "default",
    dir: "asc",
  });
  const [editing, setEditing] = useState<{ id: string; column: Column } | null>(
    null,
  );
  // Lokal gespeicherte Änderungen, bis der Server-Stand nachzieht. Kommt
  // ein neuer Stand vom Server, gilt wieder dieser — sonst würden lokale
  // Werte Änderungen von anderswo dauerhaft überdecken.
  const [patches, setPatches] = useState<Record<string, Partial<Editable>>>({});
  const [serverState, setServerState] = useState(achievements);
  if (serverState !== achievements) {
    setServerState(achievements);
    setPatches({});
  }
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merged = useMemo(
    () => achievements.map((a) => ({ ...a, ...patches[a.id] })),
    [achievements, patches],
  );

  // Alle Filter ausser dem Reiter — daraus zählen die Reiter-Badges.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return merged.filter((a) => {
      if (status === "active" && !a.active) return false;
      if (status === "inactive" && a.active) return false;
      if (scope !== "ALL" && a.scope !== scope) return false;
      if (
        needle &&
        !a.title.toLowerCase().includes(needle) &&
        !a.description.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [merged, query, scope, status]);

  const counts = useMemo(() => {
    const c = { FIXED: 0, DECKBUILDING: 0, ROTATING: 0 };
    for (const a of filtered) c[a.category]++;
    return c;
  }, [filtered]);

  const rows = useMemo(() => {
    const inTab = filtered.filter((a) => a.category === tab);
    const byDefault = (a: TableAchievement, b: TableAchievement) =>
      a.sortOrder - b.sortOrder;
    const compare: Record<SortKey, typeof byDefault> = {
      default: byDefault,
      title: (a, b) => collator.compare(a.title, b.title),
      scope: (a, b) =>
        SCOPES.indexOf(a.scope) - SCOPES.indexOf(b.scope) || byDefault(a, b),
      points: (a, b) => a.points - b.points || byDefault(a, b),
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return inTab.sort((a, b) => sign * compare[sort.key](a, b));
  }, [filtered, tab, sort]);

  const filtersActive =
    query.trim() !== "" || scope !== "ALL" || status !== "all";

  function resetFilters() {
    setQuery("");
    setScope("ALL");
    setStatus("all");
  }

  // Aktive des offenen Reiters, unabhängig von Suche und Filtern — damit
  // sich nach dem Umstellen der Ziehung prüfen lässt, ob es 10 sind.
  const activeInTab = merged.filter(
    (a) => a.category === tab && a.active,
  ).length;
  const totalInTab = merged.filter((a) => a.category === tab).length;

  /**
   * Klickfolge je Spalte: erste Richtung, umgekehrte Richtung, zurück zur
   * Standardreihenfolge. Punkte beginnen absteigend (höchste zuerst), die
   * übrigen aufsteigend.
   */
  function toggleSort(key: SortKey) {
    const first = key === "points" ? "desc" : "asc";
    setSort((prev) =>
      prev.key !== key
        ? { key, dir: first }
        : prev.dir === first
          ? { key, dir: first === "asc" ? "desc" : "asc" }
          : { key: "default", dir: "asc" },
    );
  }

  function commit(a: TableAchievement, patch: Partial<Editable>) {
    setEditing(null);
    setPatches((prev) => ({ ...prev, [a.id]: { ...prev[a.id], ...patch } }));
    const next = { ...a, ...patch };
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("title", next.title);
    fd.set("description", next.description);
    fd.set("points", String(next.points));
    fd.set("scope", next.scope);
    fd.set("active", String(next.active));
    startTransition(async () => {
      await updateAchievement(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  function header(key: SortKey | null, label: string, className = "") {
    const active = key !== null && sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={
          key === null
            ? undefined
            : active
              ? sort.dir === "asc"
                ? "ascending"
                : "descending"
              : "none"
        }
        className={`sticky top-0 z-10 border-b border-white/10 bg-background px-3 py-2.5 align-middle ${className}`}
      >
        {key === null ? (
          label
        ) : (
          <button
            type="button"
            onClick={() => toggleSort(key)}
            className={`inline-flex items-center gap-1.5 ${
              className.includes("text-right") ? "flex-row-reverse" : ""
            }`}
          >
            {label}
            <SortIcon direction={active ? sort.dir : null} />
          </button>
        )}
      </th>
    );
  }

  /** Eine anklickbare Zelle: zeigt den Wert oder, wenn aktiv, den Editor. */
  function cell(
    a: TableAchievement,
    column: Column,
    display: React.ReactNode,
    className = "",
  ) {
    const isEditing = editing?.id === a.id && editing.column === column;
    return (
      <td className={`border-b border-white/5 p-0 align-middle ${className}`}>
        {isEditing ? (
          <CellEditor
            column={column}
            initial={a}
            onCommit={(patch) => commit(a, patch)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing({ id: a.id, column })}
            className={`block min-h-11 w-full px-3 py-2.5 text-left outline-none ring-inset hover:ring-1 hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-blue-500 ${
              className.includes("text-right") ? "text-right" : ""
            }`}
          >
            {display}
          </button>
        )}
      </td>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titel oder Beschreibung suchen"
            aria-label="Achievements durchsuchen"
            className="min-h-11 w-full rounded border border-white/20 bg-transparent py-2 pl-9 pr-3"
          />
        </div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as AchievementScope | "ALL")}
          aria-label="Nach Art filtern"
          className="min-h-11 rounded border border-white/20 bg-background px-3 py-2"
        >
          <option value="ALL">Alle Arten</option>
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Nach Status filtern"
          className="min-h-11 rounded border border-white/20 bg-background px-3 py-2"
        >
          <option value="all">Alle Status</option>
          <option value="active">Aktive</option>
          <option value="inactive">Inaktive</option>
        </select>
        <PrimaryButton
          onClick={() => setCreating(true)}
          className="w-full sm:ml-auto sm:w-auto"
        >
          + Neues Achievement
        </PrimaryButton>
      </div>

      {/* Reiter: je Kategorie eine Tabelle. Die Grundlinie liegt auf dem
          äusseren Element — sonst ragt die Unterstreichung aus der
          seitlich scrollbaren Leiste und erzeugt einen Scrollbalken. */}
      <div className="border-b border-white/10">
        <div
          role="tablist"
          aria-label="Kategorie"
          className="flex gap-1 overflow-x-auto"
        >
          {CATEGORIES.map((c) => {
            const selected = tab === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTab(c);
                  setEditing(null);
                }}
                className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
                  selected
                    ? "border-foreground font-medium"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {TAB_LABELS[c]}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">
                  {counts[c]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3 text-xs">
        <span>
          <span className="font-medium tabular-nums">
            {activeInTab} von {totalInTab} aktiv
          </span>
          <span className="opacity-70">
            {" "}
            · Zum Ändern auf eine Zelle klicken · Enter speichert · Esc
            bricht ab
          </span>
        </span>
        <span aria-live="polite" className="shrink-0">
          {justSaved ? (
            <span className="text-green-500">✓ Gespeichert</span>
          ) : isPending ? (
            <span className="opacity-50">Speichere…</span>
          ) : filtersActive ? (
            <button
              type="button"
              onClick={resetFilters}
              className="underline opacity-70 hover:opacity-100"
            >
              Filter zurücksetzen
            </button>
          ) : null}
        </span>
      </div>

      {/* Eigene Scroll-Fläche, damit die Kopfzeile kleben bleibt; auf
          schmalen Bildschirmen seitlich scrollbar mit fixierter
          Titelspalte. */}
      <div
        role="tabpanel"
        className="max-h-[70vh] overflow-auto rounded border border-white/10"
      >
        <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
          <thead className="text-left">
            <tr>
              {header(null, "Aktiv", "sticky left-0 z-20 w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]")}
              {header("title", "Titel", "sticky left-[4.5rem] z-20 w-56")}
              {header(null, "Beschreibung")}
              {header("scope", "Art", "w-44")}
              {header("points", "Punkte", "w-24 text-right")}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr
                key={a.id}
                className={`group transition-colors hover:bg-surface ${
                  a.active ? "" : "text-white/50"
                }`}
              >
                {/* Schalter zuerst: nach einer Ziehung werden genau hier
                    die neuen 10 umgestellt. Fixiert wie die Titelspalte. */}
                <td
                  className="sticky left-0 z-[1] w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] border-b border-white/5 bg-background px-3 py-2.5 align-middle transition-colors group-hover:bg-surface"
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.active}
                    aria-label={`${a.title} aktiv`}
                    title={a.active ? "Aktiv" : "Inaktiv"}
                    onClick={() => commit(a, { active: !a.active })}
                    className="flex items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <span
                      className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
                        a.active ? "bg-green-600" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          a.active ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                </td>
                {/* Fixierte Titelspalte braucht einen deckenden Hintergrund,
                    sonst scheinen beim seitlichen Scrollen andere Spalten
                    durch. */}
                {cell(
                  a,
                  "title",
                  <span className="font-medium">{a.title}</span>,
                  "sticky left-[4.5rem] z-[1] bg-background group-hover:bg-surface",
                )}
                {cell(
                  a,
                  "description",
                  a.description ? (
                    <span className="whitespace-pre-line">{a.description}</span>
                  ) : (
                    <span className="opacity-40">—</span>
                  ),
                  "min-w-72",
                )}
                {cell(a, "scope", SCOPE_LABELS[a.scope], "whitespace-nowrap")}
                {cell(
                  a,
                  "points",
                  <span className="font-medium tabular-nums">
                    {formatPoints(a.points)}
                  </span>,
                  "text-right",
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
            <p className="opacity-70">Keine Achievements gefunden.</p>
            {filtersActive && (
              <SecondaryButton onClick={resetFilters}>
                Filter zurücksetzen
              </SecondaryButton>
            )}
          </div>
        )}
      </div>

      {creating && (
        <NewAchievementPanel
          category={tab}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
