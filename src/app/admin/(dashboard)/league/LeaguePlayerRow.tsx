"use client";

import { useRef, useState, useTransition } from "react";
import { formatPlayerName } from "@/lib/players";
import { colorsOf } from "@/lib/colorIdentity";
import { updateColorIdentity, updateLeaguePlayer } from "./actions";

interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  points: number;
  attendedEvenings: number;
  colorIdentity: string | null;
}

/**
 * Eine Zeile in der Liga-Verwaltung mit Auto-Save der Punkte.
 * Die besuchten Abende stehen nur lesend daneben: sie kommen aus dem
 * Import und bestimmen zusammen mit den Punkten die Rangfolge für die
 * Paarung (siehe SPEC.md Abschnitt 5.1). Sichtbar, damit ein Import, der
 * die Rundenspalten nicht erkannt hat, sofort auffällt — sonst würde die
 * App still auf Gesamtpunkte zurückfallen.
 * Name, Stufe und Liga-Teilnahme werden hier bewusst nicht editiert — das
 * lebt im Spieler-Tab (siehe SPEC.md Abschnitt 6).
 */
export default function LeaguePlayerRow({ player }: { player: Player }) {
  const [points, setPoints] = useState(String(player.points));
  const [colors, setColors] = useState(player.colorIdentity ?? "");
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function save(action: (fd: FormData) => Promise<void>, field: string, value: string) {
    const fd = new FormData();
    fd.set("id", player.id);
    fd.set(field, value);

    startTransition(async () => {
      await action(fd);
      setJustSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
    });
  }

  return (
    <tr className="border-b border-white/5">
      <td className="py-2 pr-3">{formatPlayerName(player)}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {player.attendedEvenings > 0 ? (
          <>
            {player.attendedEvenings}
            <span className="opacity-50">
              {" "}
              · ⌀ {(player.points / player.attendedEvenings).toFixed(1)}
            </span>
          </>
        ) : (
          <span className="text-amber-500">keine</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          value={points}
          onChange={(e) => {
            setPoints(e.target.value);
            save(updateLeaguePlayer, "points", e.target.value);
          }}
          className="min-h-9 w-20 rounded border border-white/20 px-3 py-2"
        />
      </td>
      <td className="py-2 pr-3">
        {/* Textfeld mit Speichern beim Verlassen (SPEC.md 6.4); beim
            Speichern auf die erkannten Farben in WUBRG-Reihenfolge
            normalisiert, wie es auch der Server tut. */}
        <input
          type="text"
          value={colors}
          onChange={(e) => setColors(e.target.value)}
          onBlur={() => {
            const normalized = colorsOf(colors.toUpperCase()).join("");
            setColors(normalized);
            if (normalized !== (player.colorIdentity ?? "")) {
              save(updateColorIdentity, "colorIdentity", normalized);
            }
          }}
          aria-label={`Farbidentität von ${formatPlayerName(player)}`}
          placeholder="z.B. WR"
          className="min-h-9 w-28 rounded border border-white/20 px-3 py-2 uppercase"
        />
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
