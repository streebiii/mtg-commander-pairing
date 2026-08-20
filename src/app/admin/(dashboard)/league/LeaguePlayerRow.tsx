"use client";

import { useRef, useState, useTransition } from "react";
import { formatPlayerName } from "@/lib/players";
import { updateLeaguePlayer } from "./actions";

interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  points: number;
  leagueActive: boolean;
}

/**
 * Eine Zeile in der Liga-Verwaltung mit Auto-Save (Punkte + Teilnahme-Flag).
 * Name und Elo werden hier bewusst nicht angezeigt/editiert — das lebt im
 * Spieler-Tab (siehe SPEC.md Abschnitt 6).
 */
export default function LeaguePlayerRow({ player }: { player: Player }) {
  const [points, setPoints] = useState(String(player.points));
  const [leagueActive, setLeagueActive] = useState(player.leagueActive);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(overrides: Partial<{ points: string; leagueActive: boolean }> = {}) {
    const fd = new FormData();
    fd.set("id", player.id);
    fd.set("points", overrides.points ?? points);
    fd.set("leagueActive", String(overrides.leagueActive ?? leagueActive));

    startTransition(async () => {
      await updateLeaguePlayer(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="py-2 pr-3">{formatPlayerName(player)}</td>
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
        <label className="flex min-h-9 items-center gap-1.5">
          <input
            type="checkbox"
            checked={leagueActive}
            onChange={(e) => {
              setLeagueActive(e.target.checked);
              save({ leagueActive: e.target.checked });
            }}
            className="h-4 w-4"
          />
          teilnehmend
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
    </tr>
  );
}
