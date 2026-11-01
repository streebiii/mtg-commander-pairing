import type { ReactNode } from "react";
import EntrySheet from "@/components/EntrySheet";
import { loadPublicNames } from "@/lib/publicRoster";
import AutoRefresh from "@/components/AutoRefresh";
import { getDeviceEntry, loadSheet } from "@/lib/entries";
import { winnerNotes } from "@/lib/winner";
import { deviceSheetVersion } from "./version";
import { eveningLabel } from "@/lib/season";
import { markGame1Done, setMyMark, submitMine } from "./actions";
import ConfirmButton from "./ConfirmButton";

export const dynamic = "force-dynamic";

// Erfassungsblatt des Spielers, der auf diesem Gerät angemeldet ist (siehe
// SPEC.md Abschnitt 12). Angemeldet wird über die Tischkarte; ohne
// gültiges Geräte-Cookie gibt es hier nur einen Hinweis.
export default async function MyEntryPage() {
  const entry = await getDeviceEntry();

  if (!entry) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-8">
        <h1 className="text-xl font-semibold">Achievements erfassen</h1>
        <p className="text-base opacity-70">
          Scanne die Tischkarte an deinem Tisch und tippe auf deinen Namen.
        </p>
      </div>
    );
  }

  const [sheet, names] = await Promise.all([
    loadSheet(entry.eveningId, entry.playerId),
    loadPublicNames(),
  ]);
  const notes = await winnerNotes(entry.eveningId, entry.playerId, sheet.gamesPlayed, names);
  const closed = entry.evening.entryClosedAt !== null;
  const lastGame = sheet.gamesPlayed.at(-1);
  // Nach Match 1 kommt noch Match 2, ausser der Abend ist vorbei oder es
  // läuft schon ohne diesen Spieler.
  const match2Ahead = lastGame === 1 && !sheet.finished && !sheet.liveRounds.includes(2);

  function confirmSlot() {
    if (closed || lastGame === undefined) return null;
    if (match2Ahead) {
      if (sheet.lockedGames.includes(1)) {
        return <Note>Match 2 ist ausgelost. Sobald es live ist, erscheint es hier.</Note>;
      }
      return entry!.game1DoneAt ? (
        <Note>Match 1 bestätigt. Sobald Match 2 live ist, erscheint es hier.</Note>
      ) : (
        <ConfirmButton label="Match 1 bestätigen" action={markGame1Done} />
      );
    }
    return entry!.submittedAt ? (
      <Note>Bestätigt. Bis die Erfassung geschlossen wird, kannst du noch korrigieren.</Note>
    ) : (
      <ConfirmButton label={`Match ${lastGame} bestätigen`} action={submitMine} />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-6">
      {closed && (
        <p className="mt-4 rounded border border-white/20 px-3 py-2 text-base">
          Die Erfassung für diese Runde ist geschlossen.
        </p>
      )}

      {!closed && (
        <AutoRefresh src="/erfassen/stand" version={deviceSheetVersion(sheet, notes)} />
      )}

      <EntrySheet
        sheet={sheet}
        winnerNotes={notes}
        locked={closed}
        onSetMark={setMyMark}
        stepped
        storageKey={entry.id}
        title={names.get(entry.playerId) ?? entry.player.firstName}
        subtitle={eveningLabel(entry.evening.date)}
        submitSlot={confirmSlot()}
      />
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-green-600/40 bg-green-600/10 px-3 py-2 text-base">
      {children}
    </p>
  );
}
