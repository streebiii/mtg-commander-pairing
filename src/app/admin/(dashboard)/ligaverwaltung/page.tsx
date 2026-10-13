import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { type EntryStatus, findOpenEvening, loadEveningOverview } from "@/lib/entries";
import { eveningLabel, eveningNumber, nextSeasonEvening } from "@/lib/season";
import { releaseDevice } from "./actions";
import CloseEntryButton from "./CloseEntryButton";

export const dynamic = "force-dynamic";

const STATUS: Record<EntryStatus, { label: string; dot: string }> = {
  offen: { label: "Nicht angemeldet", dot: "bg-white/40" },
  angemeldet: { label: "Erfasst gerade", dot: "bg-amber-400" },
  abgegeben: { label: "Abgegeben", dot: "bg-green-500" },
};

const ACTION =
  "inline-flex min-h-11 items-center rounded px-2 text-base underline-offset-2 hover:underline";

function dayOf(date: Date) {
  return date.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

// Reiter «Aktuelle Runde» der Ligaverwaltung (SPEC.md Abschnitt 14): die
// Achievement-Erfassung der laufenden Runde — wer abgegeben hat, Totals,
// Korrekturen und das Schliessen. Bleibt nach «Runde beenden» stehen, bis
// die Erfassung geschlossen ist. Ohne offene Erfassung: Vorbereitung der
// nächsten Runde.
export default async function CurrentRoundPage() {
  const openEvening = await findOpenEvening();
  if (!openEvening) return <Preparation />;

  const { evening, rows } = await loadEveningOverview(openEvening.id);
  const submitted = rows.filter((r) => r.status === "abgegeben").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          {eveningLabel(evening.date)} · {dayOf(evening.date)}
        </h2>
        <p className="text-base">
          {evening.finishedAt ? "Runde beendet" : "Runde läuft"} ·{" "}
          <span className="font-medium tabular-nums">
            {submitted} von {rows.length} abgegeben
          </span>
        </p>
      </div>

      <div className="w-full max-w-3xl overflow-x-auto rounded border border-white/10">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-base">
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
                <td className="border-b border-white/5 px-3 py-0.5">
                  <div className="flex flex-wrap justify-end gap-1">
                    {r.entryId && r.hasDevice && (
                      <form action={releaseDevice.bind(null, r.entryId)}>
                        <button type="submit" className={ACTION}>
                          Handy freigeben
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/ligaverwaltung/runden/${evening.id}/${r.playerId}`}
                      className={ACTION}
                    >
                      Korrigieren
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-base opacity-70">
        «Handy freigeben» löst die Bindung an ein Gerät, z.B. nach einem
        Handywechsel — die Einträge bleiben erhalten.
      </p>

      <CloseEntryButton
        eveningId={evening.id}
        openCount={rows.length - submitted}
        suggestedRound={eveningNumber(evening.date)}
      />
    </div>
  );
}

/**
 * Ohne offene Erfassung: was vor der nächsten Runde zu tun ist. Gestartet
 * wird im Liga-Tab — hier steht nur, ob alles bereit ist.
 */
async function Preparation() {
  const [activeRotating, totalRotating] = await Promise.all([
    prisma.achievement.count({ where: { category: "ROTATING", active: true } }),
    prisma.achievement.count({ where: { category: "ROTATING" } }),
  ]);
  const next = nextSeasonEvening(new Date());
  const rotatingOk = activeRotating === 10;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          {next
            ? `Nächste Runde: R${next.number} · ${new Date(`${next.date}T12:00:00`).toLocaleDateString("de-CH")}`
            : "Die Saison ist abgeschlossen"}
        </h2>
        <p className="text-base opacity-70">Gerade ist keine Erfassung offen.</p>
      </div>

      <ul className="flex flex-col gap-2 text-base">
        <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 px-4 py-3">
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{rotatingOk ? "✓" : "⚠"}</span>
            Rotierende Achievements:{" "}
            <span className={`font-medium tabular-nums ${rotatingOk ? "" : "text-amber-400"}`}>
              {activeRotating} von {totalRotating} aktiv
            </span>
          </span>
          <Link
            href="/admin/ligaverwaltung/achievements"
            className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
          >
            Prüfen ›
          </Link>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 px-4 py-3">
          <span>Runde starten</span>
          <Link
            href="/admin/league"
            className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
          >
            Zum Liga-Tab ›
          </Link>
        </li>
      </ul>
    </div>
  );
}
