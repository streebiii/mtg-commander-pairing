import { getDeviceEntry, loadSheet } from "@/lib/entries";
import { loadPublicNames } from "@/lib/publicRoster";
import { winnerNotes } from "@/lib/winner";
import { deviceSheetVersion } from "../version";

// Stand des Erfassungsblatts dieses Geräts (siehe AutoRefresh). Setzt der
// Organisator den Sieger, ändert er sich — das Blatt lädt dann neu und
// zeigt «Winner winner».
export const dynamic = "force-dynamic";

export async function GET() {
  const entry = await getDeviceEntry();
  let version = "kein-geraet";
  if (entry) {
    const [sheet, names] = await Promise.all([
      loadSheet(entry.eveningId, entry.playerId),
      loadPublicNames(),
    ]);
    const notes = await winnerNotes(entry.eveningId, entry.playerId, sheet.gamesPlayed, names);
    version = deviceSheetVersion(sheet, notes);
  }
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
