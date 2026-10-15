"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import ColorDots from "@/components/ColorDots";
import { colorsOf } from "@/lib/colorIdentity";
import { decklistHost, normalizeDecklistUrl } from "@/lib/decklist";
import { SKILL_LEVELS } from "@/lib/players";
import { updatePlayer } from "./actions";
import NewPlayerPanel from "./NewPlayerPanel";

export interface TablePlayer {
  id: string;
  firstName: string;
  lastName: string | null;
  skillLevel: number;
  leagueActive: boolean;
  colorIdentity: string | null;
  decklistUrl: string | null;
  /** Saisonpunkte laut Rangliste — null, wer nicht in der Liga ist. */
  seasonPoints: number | null;
}

type Editable = Pick<
  TablePlayer,
  "firstName" | "lastName" | "skillLevel" | "leagueActive" | "colorIdentity" | "decklistUrl"
>;
type Column = "firstName" | "lastName" | "skillLevel" | "colorIdentity" | "decklistUrl";
type SortKey = "firstName" | "lastName" | "skillLevel" | "seasonPoints";
type LeagueFilter = "all" | "league" | "other";

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
 * Editor einer angeklickten Zelle — wie im Achievement-Katalog: Enter oder
 * Verlassen speichert, Esc verwirft.
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
  const [text, setText] = useState(() => String(initial[column] ?? ""));
  const [invalid, setInvalid] = useState(false);
  // Verhindert ein zweites Speichern durch das Blur nach Enter bzw. Esc.
  const done = useRef(false);

  function commit(value: string) {
    if (done.current) return;
    if (column === "decklistUrl") {
      const decklistUrl = normalizeDecklistUrl(value);
      // Ungültige Adresse: Feld offen lassen und markieren, statt sie still
      // zu verwerfen.
      if (decklistUrl === undefined) {
        setInvalid(true);
        return;
      }
      done.current = true;
      if (decklistUrl !== initial.decklistUrl) onCommit({ decklistUrl });
      else onCancel();
      return;
    }
    done.current = true;
    if (column === "firstName") {
      const firstName = value.trim();
      if (firstName && firstName !== initial.firstName) onCommit({ firstName });
      else onCancel();
    } else if (column === "lastName") {
      const lastName = value.trim() || null;
      if (lastName !== initial.lastName) onCommit({ lastName });
      else onCancel();
    } else if (column === "skillLevel") {
      const skillLevel = Number(value);
      if (skillLevel !== initial.skillLevel) onCommit({ skillLevel });
      else onCancel();
    } else {
      const colorIdentity = colorsOf(value.toUpperCase()).join("") || null;
      if (colorIdentity !== initial.colorIdentity) onCommit({ colorIdentity });
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
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(text);
    }
  }

  if (column === "skillLevel") {
    return (
      <select
        autoFocus
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={cancel}
        onKeyDown={onKeyDown}
        aria-label="Stufe"
        className={CELL_INPUT}
      >
        {SKILL_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    );
  }

  const input = (
    <input
      autoFocus
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      // Auch beim Verlassen nicht verwerfen: eine ungültige Adresse bleibt
      // stehen und ist markiert, bis sie korrigiert oder mit Esc verworfen
      // wird. Früher ging sie beim zweiten Verlassen still verloren.
      onBlur={() => commit(text)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      placeholder={
        column === "colorIdentity" ? "z.B. WR" : column === "decklistUrl" ? "https://…" : undefined
      }
      aria-label={
        column === "firstName"
          ? "Vorname"
          : column === "lastName"
            ? "Nachname"
            : column === "decklistUrl"
              ? "Link zur Deckliste"
              : "Farben"
      }
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? "decklist-error" : undefined}
      className={`${CELL_INPUT} ${column === "colorIdentity" ? "uppercase" : ""} ${
        invalid ? "ring-red-500" : ""
      }`}
    />
  );

  if (!invalid) return input;
  // Sichtbar statt nur als Tooltip — den sieht man auf dem Handy nie.
  return (
    <>
      {input}
      <span id="decklist-error" role="alert" className="block px-3 pb-2 text-base text-red-400">
        Keine gültige Adresse — Esc verwirft.
      </span>
    </>
  );
}

/**
 * Spielerverwaltung (SPEC.md Abschnitt 6), gebaut wie der
 * Achievement-Katalog: Werkzeugleiste mit Suche und Filter, sortierbare
 * Spalten, Inline-Bearbeitung und «Neuer Spieler» im Seitenpanel. Die
 * Liga-Teilnahme ist ein Schalter. Ein Klick auf «Achievements» öffnet die
 * Seite des Spielers mit seinen Achievements pro Runde.
 */
export default function PlayerTable({ players }: { players: TablePlayer[] }) {
  const [query, setQuery] = useState("");
  const [league, setLeague] = useState<LeagueFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "firstName",
    dir: "asc",
  });
  const [editing, setEditing] = useState<{ id: string; column: Column } | null>(null);
  // Lokal gespeicherte Änderungen, bis der Server-Stand nachzieht (wie im
  // Achievement-Katalog).
  const [patches, setPatches] = useState<Record<string, Partial<Editable>>>({});
  const [serverState, setServerState] = useState(players);
  if (serverState !== players) {
    setServerState(players);
    setPatches({});
  }
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const merged = useMemo(
    () => players.map((p) => ({ ...p, ...patches[p.id] })),
    [players, patches],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = merged.filter((p) => {
      if (league === "league" && !p.leagueActive) return false;
      if (league === "other" && p.leagueActive) return false;
      const name = `${p.firstName} ${p.lastName ?? ""}`.toLowerCase();
      return !needle || name.includes(needle);
    });
    const byName = (a: TablePlayer, b: TablePlayer) =>
      collator.compare(a.firstName, b.firstName) ||
      collator.compare(a.lastName ?? "", b.lastName ?? "");
    const compare: Record<SortKey, typeof byName> = {
      firstName: byName,
      lastName: (a, b) => collator.compare(a.lastName ?? "", b.lastName ?? "") || byName(a, b),
      skillLevel: (a, b) => a.skillLevel - b.skillLevel || byName(a, b),
      seasonPoints: (a, b) =>
        (a.seasonPoints ?? -1) - (b.seasonPoints ?? -1) || byName(a, b),
    };
    const sign = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => sign * compare[sort.key](a, b));
  }, [merged, query, league, sort]);

  const filtersActive = query.trim() !== "" || league !== "all";
  const leagueCount = merged.filter((p) => p.leagueActive).length;

  function toggleSort(key: SortKey) {
    const first = key === "seasonPoints" ? "desc" : "asc";
    setSort((prev) =>
      prev.key !== key
        ? { key, dir: first }
        : { key, dir: prev.dir === "asc" ? "desc" : "asc" },
    );
  }

  function commit(p: TablePlayer, patch: Partial<Editable>) {
    setEditing(null);
    setPatches((prev) => ({ ...prev, [p.id]: { ...prev[p.id], ...patch } }));
    const next = { ...p, ...patch };
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("firstName", next.firstName);
    fd.set("lastName", next.lastName ?? "");
    fd.set("skillLevel", String(next.skillLevel));
    fd.set("leagueActive", String(next.leagueActive));
    fd.set("colorIdentity", next.colorIdentity ?? "");
    fd.set("decklistUrl", next.decklistUrl ?? "");
    startTransition(async () => {
      await updatePlayer(fd);
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
          key === null ? undefined : active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
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

  function cell(p: TablePlayer, column: Column, display: React.ReactNode, className = "") {
    const isEditing = editing?.id === p.id && editing.column === column;
    return (
      <td className={`border-b border-white/5 p-0 align-middle ${className}`}>
        {isEditing ? (
          <CellEditor
            column={column}
            initial={p}
            onCommit={(patch) => commit(p, patch)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing({ id: p.id, column })}
            className="block min-h-11 w-full px-3 py-2.5 text-left outline-none ring-inset hover:ring-1 hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-blue-500"
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
            placeholder="Name suchen"
            aria-label="Spieler durchsuchen"
            className="min-h-11 w-full rounded border border-white/20 bg-transparent py-2 pl-9 pr-3"
          />
        </div>
        <select
          value={league}
          onChange={(e) => setLeague(e.target.value as LeagueFilter)}
          aria-label="Nach Liga-Teilnahme filtern"
          className="min-h-11 rounded border border-white/20 bg-background px-3 py-2"
        >
          <option value="all">Alle Spieler</option>
          <option value="league">Liga-Teilnehmende</option>
          <option value="other">Nicht in der Liga</option>
        </select>
        <PrimaryButton onClick={() => setCreating(true)} className="w-full sm:ml-auto sm:w-auto">
          + Neuer Spieler
        </PrimaryButton>
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3 text-base">
        <span>
          <span className="font-medium tabular-nums">
            {merged.length} Spieler, {leagueCount} in der Liga
          </span>
          <span className="opacity-70"> · Zum Ändern auf eine Zelle klicken · Enter speichert · Esc bricht ab</span>
        </span>
        <span aria-live="polite" className="shrink-0">
          {justSaved ? (
            <span className="text-green-500">✓ Gespeichert</span>
          ) : isPending ? (
            <span className="opacity-50">Speichere…</span>
          ) : filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLeague("all");
              }}
              className="underline opacity-70 hover:opacity-100"
            >
              Filter zurücksetzen
            </button>
          ) : null}
        </span>
      </div>

      {/* Eigene Scroll-Fläche, damit die Kopfzeile kleben bleibt; auf
          schmalen Bildschirmen seitlich scrollbar mit fixierter
          Namensspalte. */}
      <div className="max-h-[70vh] overflow-auto rounded border border-white/10">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-base">
          <thead className="text-left">
            <tr>
              {header(null, "Liga", "sticky left-0 z-20 w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]")}
              {header("firstName", "Vorname", "sticky left-[4.5rem] z-20 w-40")}
              {header("lastName", "Nachname", "w-40")}
              {header("skillLevel", "Stufe", "w-24")}
              {header(null, "Farben", "w-32")}
              {header(null, "Deckliste", "w-44")}
              {header("seasonPoints", "Saison", "w-28 text-right")}
              {header(null, "", "w-40")}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
              return (
                <tr key={p.id} className="group transition-colors hover:bg-surface">
                  <td className="sticky left-0 z-[1] w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] border-b border-white/5 bg-background px-3 py-2.5 align-middle transition-colors group-hover:bg-surface">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.leagueActive}
                      aria-label={`${name} nimmt an der Liga teil`}
                      title={p.leagueActive ? "Nimmt an der Liga teil" : "Nicht in der Liga"}
                      onClick={() => commit(p, { leagueActive: !p.leagueActive })}
                      className="flex items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                      <span
                        className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
                          p.leagueActive ? "bg-green-600" : "bg-white/20"
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            p.leagueActive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                  </td>
                  {cell(
                    p,
                    "firstName",
                    <span className="font-medium">{p.firstName}</span>,
                    "sticky left-[4.5rem] z-[1] bg-background group-hover:bg-surface",
                  )}
                  {cell(p, "lastName", p.lastName ?? <span className="opacity-40">—</span>)}
                  {cell(p, "skillLevel", <span className="tabular-nums">{p.skillLevel}</span>)}
                  {cell(
                    p,
                    "colorIdentity",
                    p.colorIdentity ? (
                      <span className="inline-flex items-center gap-2">
                        <ColorDots identity={p.colorIdentity} size="h-3 w-3" />
                        {p.colorIdentity}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    ),
                  )}
                  {cell(
                    p,
                    "decklistUrl",
                    p.decklistUrl ? (
                      <span className="block truncate" title={p.decklistUrl}>
                        {decklistHost(p.decklistUrl)}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    ),
                    "max-w-44",
                  )}
                  <td className="border-b border-white/5 px-3 py-2.5 text-right align-middle font-medium tabular-nums">
                    {p.seasonPoints ?? <span className="font-normal opacity-40">—</span>}
                  </td>
                  <td className="border-b border-white/5 px-3 py-1.5 text-right align-middle">
                    <Link
                      href={`/admin/players/${p.id}`}
                      className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded px-2 hover:bg-white/10"
                    >
                      Achievements ›
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-base">
            <p className="opacity-70">Keine Spieler gefunden.</p>
            {filtersActive && (
              <SecondaryButton
                onClick={() => {
                  setQuery("");
                  setLeague("all");
                }}
              >
                Filter zurücksetzen
              </SecondaryButton>
            )}
          </div>
        )}
      </div>
      <p className="text-base opacity-70">
        Entfernen lässt sich ein Spieler auf seiner Seite («Achievements ›»).
      </p>

      {creating && <NewPlayerPanel onClose={() => setCreating(false)} />}
    </div>
  );
}
