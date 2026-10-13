"use client";

import { useOptimistic, useState, useTransition } from "react";
import TableCard from "@/components/TableCard";
import { formatPlayerName } from "@/lib/players";
import { dropPlayer, setTableResult, swapPlayers, undoDrop } from "./actions";

interface AssignmentView {
  id: string;
  playerId: string;
  isWinner: boolean;
  droppedAt: Date | null;
  player: { firstName: string; lastName: string | null };
}

interface TableView {
  id: string;
  tableNumber: number;
  size: number;
  resultEnteredAt: Date | null;
  assignments: AssignmentView[];
}

type OptimisticAction =
  | { type: "swap"; assignmentAId: string; assignmentBId: string }
  | { type: "setResult"; tableId: string; winnerAssignmentId: string }
  | { type: "drop"; assignmentId: string; dropped: boolean };

/**
 * Wendet dieselbe Logik wie `swapPlayers`/`setTableResult` in actions.ts
 * lokal an, damit die Oberfläche sofort reagiert, statt auf die Server-
 * Antwort zu warten (siehe useOptimistic unten). Muss mit dem Server
 * übereinstimmen, sonst "springt" die Anzeige beim Abgleich zurück.
 */
function applyOptimisticAction(
  tables: TableView[],
  action: OptimisticAction,
): TableView[] {
  if (action.type === "swap") {
    let tableAIdx = -1, assignmentAIdx = -1;
    let tableBIdx = -1, assignmentBIdx = -1;
    tables.forEach((table, ti) => {
      table.assignments.forEach((a, ai) => {
        if (a.id === action.assignmentAId) {
          tableAIdx = ti;
          assignmentAIdx = ai;
        }
        if (a.id === action.assignmentBId) {
          tableBIdx = ti;
          assignmentBIdx = ai;
        }
      });
    });
    // Unbekannte IDs oder derselbe Tisch: nichts zu tun (der Server tauscht
    // in diesem Fall ebenfalls nicht, siehe swapPlayers).
    if (tableAIdx === -1 || tableBIdx === -1 || tableAIdx === tableBIdx) {
      return tables;
    }
    const next = tables.map((t) => ({ ...t, assignments: [...t.assignments] }));
    const assignmentA = next[tableAIdx].assignments[assignmentAIdx];
    const assignmentB = next[tableBIdx].assignments[assignmentBIdx];
    next[tableAIdx].assignments[assignmentAIdx] = assignmentB;
    next[tableBIdx].assignments[assignmentBIdx] = assignmentA;
    return next;
  }

  if (action.type === "drop") {
    return tables.map((table) => ({
      ...table,
      assignments: table.assignments.map((a) =>
        a.id === action.assignmentId
          ? { ...a, droppedAt: action.dropped ? new Date() : null }
          : a,
      ),
    }));
  }

  return tables.map((table) => {
    if (table.id !== action.tableId) return table;
    const bisherigerSieger = table.assignments.find((a) => a.isWinner)?.id ?? "";
    const istWiderruf =
      table.resultEnteredAt !== null &&
      action.winnerAssignmentId === bisherigerSieger;
    return {
      ...table,
      resultEnteredAt: istWiderruf ? null : new Date(),
      assignments: table.assignments.map((a) => ({
        ...a,
        isWinner: istWiderruf ? false : a.id === action.winnerAssignmentId,
      })),
    };
  });
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
 *
 * Mit `eveningId` erscheint neben der Krone zusätzlich «Drop» (bzw.
 * «Zurück» bei einem schon gedroppten Spieler, siehe SPEC.md Abschnitt
 * 5.3). Im Warteraum mischt ein Drop die Runde neu — das wartet auf den
 * Server; in einer laufenden Runde wird nur markiert, das wirkt sofort.
 *
 * Tausch/Krone/Unentschieden zeigen ihre Wirkung **sofort** über
 * `useOptimistic`, statt auf die Server-Antwort (inkl. revalidatePath) zu
 * warten — bei spürbarer Netzwerklatenz zur DB wirkte das Tippen sonst wie
 * wirkungslos, bis die Antwort Sekunden später eintraf.
 */
export default function RoundBoard({
  tables,
  mode,
  eveningId,
}: {
  tables: TableView[];
  mode: "draft" | "live";
  /** Gesetzt, solange sich an den Anwesenden noch etwas ändern lässt. */
  eveningId?: string;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [optimisticTables, applyOptimistic] = useOptimistic(
    tables,
    applyOptimisticAction,
  );

  function handleTap(assignmentId: string) {
    if (!armed) {
      setArmed(assignmentId);
      return;
    }
    if (armed === assignmentId) {
      setArmed(null);
      return;
    }
    const assignmentAId = armed;
    const formData = new FormData();
    formData.set("assignmentAId", assignmentAId);
    formData.set("assignmentBId", assignmentId);
    setArmed(null);
    startTransition(async () => {
      applyOptimistic({ type: "swap", assignmentAId, assignmentBId: assignmentId });
      await swapPlayers(formData);
    });
  }

  function handleCrown(tableId: string, assignmentId: string) {
    const formData = new FormData();
    formData.set("tableId", tableId);
    formData.set("winnerAssignmentId", assignmentId);
    setArmed(null);
    startTransition(async () => {
      applyOptimistic({ type: "setResult", tableId, winnerAssignmentId: assignmentId });
      await setTableResult(formData);
    });
  }

  function handleDrop(assignment: AssignmentView) {
    if (!eveningId) return;
    const dropped = assignment.droppedAt === null;
    setArmed(null);
    startTransition(async () => {
      if (mode === "live") {
        applyOptimistic({ type: "drop", assignmentId: assignment.id, dropped });
      }
      await (dropped ? dropPlayer : undoDrop)(eveningId, assignment.playerId);
    });
  }

  function handleTie(tableId: string) {
    const formData = new FormData();
    formData.set("tableId", tableId);
    formData.set("winnerAssignmentId", "");
    setArmed(null);
    startTransition(async () => {
      applyOptimistic({ type: "setResult", tableId, winnerAssignmentId: "" });
      await setTableResult(formData);
    });
  }

  return (
    <div className="flex flex-wrap gap-4">
      {optimisticTables.map((table) => {
        const erfasst = table.resultEnteredAt !== null;
        const sieger = table.assignments.find((a) => a.isWinner);
        return (
          <TableCard
            key={table.id}
            tableNumber={table.tableNumber}
            size={table.size}
            tone={mode === "live" && !erfasst ? "attention" : "default"}
            aside={
              mode === "live" && (
                <span className="opacity-70">
                  {!erfasst ? "offen" : sieger ? "Sieger steht" : "unentschieden"}
                </span>
              )
            }
          >
            <ul className="flex flex-col gap-2">
              {table.assignments.map((a) => {
                const isArmed = armed === a.id;
                const isDropped = a.droppedAt !== null;
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTap(a.id)}
                      disabled={isPending}
                      className={`flex min-h-11 flex-1 items-center gap-2 rounded border px-3 py-2 text-left text-base transition-colors disabled:opacity-60 ${
                        isArmed
                          ? "border-blue-500 bg-blue-500/10"
                          : a.isWinner
                            ? "border-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                            : "border-white/10 hover:bg-white/5"
                      }`}
                    >
                      <span className="w-4 shrink-0" aria-hidden="true">
                        {a.isWinner ? "🏆" : ""}
                      </span>
                      <span className={`truncate ${isDropped ? "line-through opacity-60" : ""}`}>
                        {formatPlayerName(a.player)}
                      </span>
                      {isDropped && (
                        <span className="ml-auto shrink-0 text-base opacity-70">gedroppt</span>
                      )}
                    </button>
                    {mode === "live" && isArmed && (
                      <button
                        type="button"
                        onClick={() => handleCrown(table.id, a.id)}
                        disabled={isPending}
                        aria-label={`${formatPlayerName(a.player)} als Sieger markieren`}
                        title="Als Sieger markieren"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-amber-500 text-lg transition-colors hover:bg-amber-500/10 disabled:opacity-60"
                      >
                        👑
                      </button>
                    )}
                    {eveningId && isArmed && (
                      <button
                        type="button"
                        onClick={() => handleDrop(a)}
                        disabled={isPending}
                        aria-label={`${formatPlayerName(a.player)} ${isDropped ? "zurückholen" : "droppen"}`}
                        title={
                          isDropped
                            ? "Drop zurücknehmen"
                            : mode === "live"
                              ? "Spielt die nächste Runde nicht mehr"
                              : "Spielt nicht mit — Runde wird neu gemischt"
                        }
                        className="flex h-11 shrink-0 items-center justify-center rounded border border-red-500/60 px-3 text-base transition-colors hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {isDropped ? "Zurück" : "Drop"}
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
                className={`mt-2 min-h-11 w-full rounded border px-3 py-2 text-base transition-colors disabled:opacity-60 ${
                  erfasst && !sieger
                    ? "border-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                    : "border-dashed border-white/20 hover:bg-white/5"
                }`}
              >
                Unentschieden
              </button>
            )}
          </TableCard>
        );
      })}
    </div>
  );
}
