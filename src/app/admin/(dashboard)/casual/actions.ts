"use server";

import { revalidatePath } from "next/cache";
import { clearCasualPairing, saveCasualPairing } from "@/lib/casualPairing";

/** Beide Ansichten zeigen die Zuteilung — nach Änderungen auffrischen. */
function revalidateCasualViews() {
  revalidatePath("/");
  revalidatePath("/admin/casual");
}

/**
 * Übernimmt eine (ggf. von Hand angepasste) Zuteilung als die aktuell
 * gültige. Wird nach dem manuellen Tauschen zweier Spieler aufgerufen,
 * damit die öffentliche Ansicht dasselbe zeigt wie der Organisator-Bildschirm.
 */
export async function persistCasualPairing(
  tables: { tableNumber: number; playerIds: string[] }[],
): Promise<void> {
  await saveCasualPairing(tables);
  revalidateCasualViews();
}

/** Verwirft die aktuelle Zuteilung (Knopf "Zurücksetzen"). */
export async function resetCasualPairing(): Promise<void> {
  await clearCasualPairing();
  revalidateCasualViews();
}
