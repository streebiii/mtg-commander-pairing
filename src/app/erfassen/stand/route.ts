import { getDeviceEntry, loadSheet, waitingNote } from "@/lib/entries";
import { deviceSheetVersion } from "../version";

// Stand des Blatts dieses Geräts (siehe AutoRefresh). Schaltet der
// Organisator ein Match live, tauscht Spieler oder teilt einen
// Nachzügler ein, ändert er sich — das Blatt lädt dann neu.
export const dynamic = "force-dynamic";

export async function GET() {
  const entry = await getDeviceEntry();
  let version = "kein-geraet";
  if (entry) {
    const sheet = await loadSheet(entry.eveningId, entry.playerId);
    const waiting = await waitingNote(entry.eveningId, entry.playerId, sheet);
    version = deviceSheetVersion(sheet, waiting);
  }
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
