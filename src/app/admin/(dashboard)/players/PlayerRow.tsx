"use client";

import { useRef, useState, useTransition } from "react";
import { SKILL_LEVEL_OPTIONS } from "@/lib/players";
import { deletePlayer, updatePlayer } from "./actions";

interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  points: number;
  skillLevel: number;
  assignmentCount: number;
}

/**
 * Eine Spielerzeile mit Auto-Save: jede Änderung (Zahl/Auswahl sofort bei
 * Änderung, Text bei Verlassen des Feldes) speichert automatisch, ohne
 * expliziten "Speichern"-Klick. Kontrollierte Eingabefelder (statt
 * `defaultValue`) vermeiden dabei den Fehler, bei dem ein Wert nach einem
 * Server-Re-Render nicht mehr zuverlässig übernommen wurde.
 */
export default function PlayerRow({ player }: { player: Player }) {
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName ?? "");
  const [points, setPoints] = useState(String(player.points));
  const [skillLevel, setSkillLevel] = useState(player.skillLevel);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(overrides: Partial<{
    firstName: string;
    lastName: string;
    points: string;
    skillLevel: number;
  }> = {}) {
    const fd = new FormData();
    fd.set("id", player.id);
    fd.set("firstName", overrides.firstName ?? firstName);
    fd.set("lastName", overrides.lastName ?? lastName);
    fd.set("points", overrides.points ?? points);
    fd.set("skillLevel", String(overrides.skillLevel ?? skillLevel));

    startTransition(async () => {
      await updatePlayer(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  function handleDelete() {
    if (!window.confirm(`${firstName} ${lastName} wirklich löschen?`)) return;
    const fd = new FormData();
    fd.set("id", player.id);
    startTransition(() => {
      deletePlayer(fd);
    });
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-2 pr-3">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => save()}
          className="min-h-9 w-32 rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="text"
          value={lastName}
          placeholder="(optional)"
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => save()}
          className="min-h-9 w-32 rounded border border-black/20 px-3 py-2 dark:border-white/20"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          value={points}
          onChange={(e) => {
            setPoints(e.target.value);
            save({ points: e.target.value });
          }}
          className="min-h-9 w-20 rounded border border-black/20 px-3 py-2 dark:border-white/20"
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
          className="min-h-9 w-14 rounded border border-black/20 px-2 py-2 dark:border-white/20"
        >
          {SKILL_LEVEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3 text-xs opacity-70">
        {player.assignmentCount} Abend(e)
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
        {player.assignmentCount === 0 ? (
          <button
            type="button"
            onClick={handleDelete}
            className="flex min-h-11 items-center text-xs text-red-600 underline"
          >
            Löschen
          </button>
        ) : (
          <span
            className="text-xs opacity-50"
            title="Spieler hat bereits an Abenden teilgenommen"
          >
            —
          </span>
        )}
      </td>
    </tr>
  );
}
