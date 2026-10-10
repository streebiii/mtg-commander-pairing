import Link from "next/link";
import { formatPlayerName } from "@/lib/players";
import { type EntryStatus, findOpenEvening, loadEveningOverview } from "@/lib/entries";
import { eveningNumber } from "@/lib/season";
import { releaseDevice, reopenEntry } from "./actions";
import CloseEntryButton from "./CloseEntryButton";

export const dynamic = "force-dynamic";

const STATUS: Record<EntryStatus, { label: string; dot: string }> = {
  offen: { label: "Nicht angemeldet", dot: "bg-white/40" },
  angemeldet: { label: "Erfasst gerade", dot: "bg-amber-400" },
  abgegeben: { label: "Abgegeben", dot: "bg-green-500" },
};

const ACTION =
  "inline-flex min-h-9 items-center rounded px-2 text-xs underline-offset-2 hover:underline";

// Übersicht der Achievement-Erfassung des aktuellen Liga-Abends (siehe
// SPEC.md Abschnitt 12): wer hat abgegeben, Totals, Korrekturen und das
// Schliessen der Erfassung. Bleibt nach «Abend beenden» erreichbar, bis
// die Erfassung geschlossen ist.
export default async function EntryOverviewPage() {
  const openEvening = await findOpenEvening();

  if (!openEvening) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <p className="text-sm opacity-70">
          Gerade ist keine Erfassung offen. Sie beginnt automatisch mit dem
          nächsten Liga-Abend.
        </p>
      </div>
    );
  }

  const { evening, rows } = await loadEveningOverview(openEvening.id);
  const submitted = rows.filter((r) => r.status === "abgegeben").length;

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <p className="text-sm opacity-70">
        Liga-Abend {eveningNumber(evening.date)} ·{" "}
        {evening.date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
        {evening.finishedAt ? " · Abend beendet" : " · Abend läuft"} ·{" "}
        <span className="font-medium opacity-100">
          {submitted} von {rows.length} abgegeben
        </span>
      </p>

      <div className="w-full max-w-3xl overflow-x-auto rounded border border-white/10">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
          <thead className="text-left">
            <tr>
              <th className="border-b border-white/10 px-3 py-2.5">Spieler</th>
              <th className="border-b border-white/10 px-3 py-2.5">Status</th>
              <th className="border-b border-white/10 px-3 py-2.5 text-right">Total</th>
              <th className="border-b border-white/10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="hover:bg-surface">
                <td className="border-b border-white/5 px-3 py-2.5 font-medium">
                  {formatPlayerName(r.name)}
                </td>
                <td className="border-b border-white/5 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS[r.status].dot}`} />
                    {STATUS[r.status].label}
                  </span>
                </td>
                <td className="border-b border-white/5 px-3 py-2.5 text-right font-medium tabular-nums">
                  {r.total}
                </td>
                <td className="border-b border-white/5 px-3 py-1.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link href={`/admin/erfassung/${r.playerId}`} className={ACTION}>
                      Bearbeiten
                    </Link>
                    {r.entryId && r.status === "abgegeben" && (
                      <form action={reopenEntry.bind(null, r.entryId)}>
                        <button type="submit" className={ACTION}>
                          Wieder öffnen
                        </button>
                      </form>
                    )}
                    {r.entryId && r.hasDevice && (
                      <form action={releaseDevice.bind(null, r.entryId)}>
                        <button type="submit" className={ACTION}>
                          Handy freigeben
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-70">
        «Handy freigeben» löst die Bindung an ein Gerät, z.B. nach einem
        Handywechsel — der Spieler meldet sich danach über die Tischkarte neu
        an, seine Einträge bleiben erhalten. Spieler mit Papierzettel
        erfasst du über «Bearbeiten».
      </p>

      <CloseEntryButton
        eveningId={evening.id}
        openCount={rows.length - submitted}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Erfassung</h1>
        <p className="text-sm opacity-70">
          Die Spieler erfassen ihre Achievements selbst über die Tischkarten.
        </p>
      </div>
      <Link
        href="/admin/erfassung/tischkarten"
        className="inline-flex min-h-11 items-center rounded border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5"
      >
        Tischkarten drucken
      </Link>
    </div>
  );
}
