"use client";

import { useState, useTransition } from "react";
import { formatPlayerName } from "@/lib/players";
import { setTableResult, swapPlayers } from "./actions";

interface AssignmentView {
  id: string;
  isWinner: boolean;
  player: { firstName: string; lastName: string | null };
}

interface TableView {
  id: string;
  tableNumber: number;
  size: number;
  resultEnteredAt: Date | null;
  assignments: AssignmentView[];
}

/**
 * Interaktive Tischanzeige für die jeweils letzte Runde eines Abends —
 * ersetzt das frühere ReassignSelect-Dropdown durchs Antippen (siehe
 * Grill-Notizen): Tap auf Spieler A hebt ihn hervor, Tap auf Spieler B
 * tauscht die beiden, nochmal auf A tippen bricht ab.
 *
 * Im "live"-Modus (Runde veröffentlicht) erscheint zusätzlich eine Krone
 * auf dem hervorgehobenen Spieler — Tap darauf markiert ihn als Sieger
 * (nochmal antippen macht's rückgängig, wie schon vorher). Im
 * "draft"-Modus (Warteraum) gibt es noch keine Sieger, nur den Tausch —
 * die Spieler sitzen ja noch nicht öffentlich sichtbar am Tisch.
 */
export default function RoundBoard({
  tables,
  mode,
}: {
  tables: TableView[];
  mode: "draft" | "live";
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTap(assignmentId: string) {
    if (!armed) {
      setArmed(assignmentId);
      return;
    }
    if (armed === assignmentId) {
      setArmed(null);
      return;
    }
    const formData = new FormData();
    formData.set("assignmentAId", armed);
    formData.set("assignmentBId", assignmentId);
    setArmed(null);
    startTransition(() => {
      swapPlayers(formData);
    });
  }

  function handleCrown(tableId: string, assignmentId: string) {
    const formData = new FormData();
    formData.set("tableId", tableId);
    formData.set("winnerAssignmentId", assignmentId);
    setArmed(null);
    startTransition(() => {
      setTableResult(formData);
    });
  }

  function handleTie(tableId: string) {
    const formData = new FormData();
    formData.set("tableId", tableId);
    formData.set("winnerAssignmentId", "");
    setArmed(null);
    startTransition(() => {
      setTableResult(formData);
    });
  }

  return (
    <div className="flex flex-wrap gap-4">
      {tables.map((table) => {
        const erfasst = table.resultEnteredAt !== null;
        const sieger = table.assignments.find((a) => a.isWinner);
        return (
          <div
            key={table.id}
            className={`w-full rounded border p-3 sm:w-64 ${
              mode === "live" && !erfasst
                ? "border-amber-500/60"
                : "border-white/20"
            }`}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">
                Tisch {table.tableNumber} ({table.size} Spieler)
              </span>
              {mode === "live" && (
                <span className="shrink-0 text-xs opacity-70">
                  {!erfasst ? "offen" : sieger ? "Sieger steht" : "unentschieden"}
                </span>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {table.assignments.map((a) => {
                const isArmed = armed === a.id;
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTap(a.id)}
                      disabled={isPending}
                      className={`flex min-h-11 flex-1 items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
                        isArmed
                          ? "border-blue-500 bg-blue-500/10"
                          : a.isWinner
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-white/10"
                      }`}
                    >
                      <span className="w-4 shrink-0" aria-hidden="true">
                        {a.isWinner ? "🏆" : ""}
                      </span>
                      <span className="truncate">{formatPlayerName(a.player)}</span>
                    </button>
                    {mode === "live" && isArmed && (
                      <button
                        type="button"
                        onClick={() => handleCrown(table.id, a.id)}
                        disabled={isPending}
                        aria-label={`${formatPlayerName(a.player)} als Sieger markieren`}
                        title="Als Sieger markieren"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-amber-500 text-lg"
                      >
                        👑
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {mode === "live" && (
              <button
                type="button"
                onClick={() => handleTie(table.id)}
                disabled={isPending}
                className={`mt-2 min-h-11 w-full rounded border px-3 py-2 text-sm ${
                  erfasst && !sieger
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-dashed border-white/20"
                }`}
              >
                Unentschieden
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
