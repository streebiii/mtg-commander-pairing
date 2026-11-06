import PlayerSheet from "@/components/PlayerSheet";
import { loadPublicNames } from "@/lib/publicRoster";
import AutoRefresh from "@/components/AutoRefresh";
import { getDeviceEntry, loadSheet, moreMatchesAhead, waitingNote } from "@/lib/entries";
import { deviceSheetVersion } from "./version";
import { eveningLabel } from "@/lib/season";
import { confirmMyStep, setMyMark } from "./actions";

export const dynamic = "force-dynamic";

// Blatt des Spielers, der auf diesem Gerät angemeldet ist (siehe SPEC.md
// Abschnitt 12.2). Angemeldet wird über den QR-Code auf dem persönlichen
// Punkteblatt (/blatt/<code>); ohne gültiges Geräte-Cookie gibt es hier
// nur einen Hinweis.
export default async function MyEntryPage() {
  const entry = await getDeviceEntry();

  if (!entry) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
        <h1 className="text-xl font-semibold">Punkte eintragen</h1>
        <p className="text-base opacity-70">
          Scanne den QR-Code auf deinem Punkteblatt.
        </p>
      </div>
    );
  }

  const [sheet, names] = await Promise.all([
    loadSheet(entry.eveningId, entry.playerId),
    loadPublicNames(),
  ]);
  const waiting = await waitingNote(entry.eveningId, entry.playerId, sheet);
  const closed = entry.evening.entryClosedAt !== null;
  const day = entry.evening.date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-6">
      {!closed && (
        <AutoRefresh src="/erfassen/stand" version={deviceSheetVersion(sheet, waiting)} />
      )}
      <PlayerSheet
        sheet={sheet}
        title={names.get(entry.playerId) ?? entry.player.firstName}
        subtitle={`${eveningLabel(entry.evening.date)} · ${day}`}
        closed={closed}
        waiting={waiting}
        matchAhead={moreMatchesAhead(sheet)}
        tablemates={sheet.seat?.others.map((id) => names.get(id) ?? "?") ?? []}
        onSetMark={setMyMark}
        onConfirm={confirmMyStep}
      />
    </div>
  );
}
