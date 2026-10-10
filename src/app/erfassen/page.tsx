import EntrySheet from "@/components/EntrySheet";
import { formatPlayerName } from "@/lib/players";
import { getDeviceEntry, loadSheet } from "@/lib/entries";
import { eveningNumber } from "@/lib/season";
import { setMyMark } from "./actions";
import SubmitEntryButton from "./SubmitEntryButton";

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
        <p className="text-sm opacity-70">
          Scanne die Tischkarte an deinem Tisch und tippe auf deinen Namen.
        </p>
      </div>
    );
  }

  const sheet = await loadSheet(entry.eveningId, entry.playerId);
  const closed = entry.evening.entryClosedAt !== null;
  const submitted = entry.submittedAt !== null;
  const locked = closed || submitted;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">{formatPlayerName(entry.player)}</h1>
        <p className="text-sm opacity-70">
          Liga-Abend {eveningNumber(entry.evening.date)} ·{" "}
          {entry.evening.date.toLocaleDateString("de-CH", {
            timeZone: "Europe/Zurich",
          })}
        </p>
      </div>

      {closed ? (
        <p className="rounded border border-white/20 px-3 py-2 text-sm">
          Die Erfassung für diesen Abend ist geschlossen.
        </p>
      ) : submitted ? (
        <p className="rounded border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm">
          Abgegeben. Für Korrekturen melde dich beim Organisator.
        </p>
      ) : (
        <p className="text-sm opacity-70">
          Hake ab, was du erreicht hast — jetzt oder am Ende des Abends. Alles
          wird sofort gespeichert. Zum Schluss «Abgeben».
        </p>
      )}

      <EntrySheet sheet={sheet} locked={locked} onSetMark={setMyMark} />

      {!locked && <SubmitEntryButton />}
    </div>
  );
}
