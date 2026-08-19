"use client";

import { useTransition } from "react";
import { reassignTable } from "./actions";

export default function ReassignSelect({
  assignmentId,
  currentTableId,
  tables,
}: {
  assignmentId: string;
  currentTableId: string;
  tables: { id: string; tableNumber: number }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      name="newTableId"
      defaultValue={currentTableId}
      disabled={isPending}
      onChange={(e) => {
        const newTableId = e.target.value;
        const formData = new FormData();
        formData.set("assignmentId", assignmentId);
        formData.set("newTableId", newTableId);
        // Direkter Aufruf der Server Action ohne umschließendes <form> —
        // vermeidet verschachtelte Formulare innerhalb der Ergebnis-Form.
        startTransition(() => {
          reassignTable(formData);
        });
      }}
      className="min-h-9 rounded border border-black/20 bg-transparent px-2 py-2 text-xs dark:border-white/20"
    >
      {tables.map((t) => (
        <option key={t.id} value={t.id}>
          Tisch {t.tableNumber}
        </option>
      ))}
    </select>
  );
}
