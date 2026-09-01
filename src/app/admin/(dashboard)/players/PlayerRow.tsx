"use client";

import { useRef, useState, useTransition } from "react";
import { SKILL_LEVELS } from "@/lib/players";
import { deletePlayer, updatePlayer } from "./actions";

interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  skillLevel: number;
  leagueActive: boolean;
  /** Sitzt der Spieler gerade an einem Tisch eines laufenden Liga-Abends? */
  inRunningEvening: boolean;
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/**
 * Eine Spielerzeile mit Auto-Save: jede Änderung (Auswahl/Checkbox sofort bei
 * Änderung, Text bei Verlassen des Feldes) speichert automatisch, ohne
 * expliziten "Speichern"-Klick. Kontrollierte Eingabefelder (statt
 * `defaultValue`) vermeiden dabei den Fehler, bei dem ein Wert nach einem
 * Server-Re-Render nicht mehr zuverlässig übernommen wurde. Die Liga-Punkte
 * werden bewusst nicht hier, sondern im Liga-Tab gepflegt.
 *
 * Die Löschbestätigung läuft bewusst inline und nicht über window.confirm:
 * in eingebetteten Browser-Ansichten (z.B. Vorschau-Panels) liefert
 * window.confirm ohne Rückfrage `false` — das Löschen wäre dort schlicht
 * wirkungslos.
 */
export default function PlayerRow({ player }: { player: Player }) {
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName ?? "");
  const [skillLevel, setSkillLevel] = useState(player.skillLevel);
  const [leagueActive, setLeagueActive] = useState(player.leagueActive);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(overrides: Partial<{
    firstName: string;
    lastName: string;
    skillLevel: number;
    leagueActive: boolean;
  }> = {}) {
    const fd = new FormData();
    fd.set("id", player.id);
    fd.set("firstName", overrides.firstName ?? firstName);
    fd.set("lastName", overrides.lastName ?? lastName);
    fd.set("skillLevel", String(overrides.skillLevel ?? skillLevel));
    fd.set("leagueActive", String(overrides.leagueActive ?? leagueActive));

    startTransition(async () => {
      await updatePlayer(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", player.id);
    startTransition(() => {
      deletePlayer(fd);
    });
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ");

  return (
    <tr className="border-b border-white/5">
      <td className="py-2 pr-3">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => save()}
          className="min-h-9 w-32 rounded border border-white/20 px-3 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="text"
          value={lastName}
          placeholder="(optional)"
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => save()}
          className="min-h-9 w-32 rounded border border-white/20 px-3 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={skillLevel}
          onChange={(e) => {
            const value = Number(e.target.value);
            setSkillLevel(value);
            save({ skillLevel: value });
          }}
          className="min-h-9 w-16 rounded border border-white/20 px-2 py-2"
        >
          {SKILL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <label className="flex min-h-11 w-fit cursor-pointer items-center pr-3">
          <input
            type="checkbox"
            checked={leagueActive}
            onChange={(e) => {
              setLeagueActive(e.target.checked);
              save({ leagueActive: e.target.checked });
            }}
            aria-label={`${displayName} nimmt an der Liga teil`}
            className="h-4 w-4"
          />
        </label>
      </td>
      <td className="py-2 pr-3 text-xs">
        <span
          className={`transition-opacity ${
            justSaved ? "opacity-100 text-green-600" : "opacity-0"
          }`}
        >
          ✓ Gespeichert
        </span>
        {isPending && !justSaved && (
          <span className="opacity-50">Speichere…</span>
        )}
      </td>
      <td className="py-2 align-middle">
        {player.inRunningEvening ? (
          <span
            className="text-xs opacity-50"
            title="Spieler ist im laufenden Liga-Abend einem Tisch zugeteilt"
          >
            im Abend
          </span>
        ) : confirmingDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="opacity-70">Löschen?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex min-h-11 items-center rounded bg-red-600 px-3 py-2 font-medium text-white disabled:opacity-40"
            >
              {isPending ? "…" : "Ja"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isPending}
              className="flex min-h-11 items-center rounded border border-white/20 px-3 py-2 disabled:opacity-40"
            >
              Nein
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`${displayName} löschen`}
            title={`${displayName} löschen`}
            className="flex min-h-11 w-11 items-center justify-center rounded text-red-600 hover:bg-red-600/10"
          >
            <TrashIcon />
          </button>
        )}
      </td>
    </tr>
  );
}
