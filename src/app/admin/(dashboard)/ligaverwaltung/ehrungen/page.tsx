import Link from "next/link";
import type { HonorEntry } from "@/lib/honors";
import { loadHonors } from "@/lib/honorsData";
import { EVENINGS_PER_SEASON } from "@/lib/season";

export const dynamic = "force-dynamic";

function EntryList({ entries, muted = false }: { entries: HonorEntry[]; muted?: boolean }) {
  return (
    <ul className={`flex flex-col gap-1 ${muted ? "opacity-60" : ""}`}>
      {entries.map((e) => (
        <li key={`${e.playerId}:${e.label}`} className="flex flex-wrap justify-between gap-x-3">
          <span className={muted ? "" : "font-medium"}>{e.name}</span>
          <span className="tabular-nums">{e.label}</span>
        </li>
      ))}
    </ul>
  );
}

// Reiter «Ehrungen» der Ligaverwaltung (SPEC.md Abschnitt 15): die
// lustigen Statistiken für die Rangverkündigung zur Vorbereitung, mit dem
// Einstieg in die Präsentation für den Beamer. Rechnet bei jedem Aufruf
// neu — nach dem Schliessen der letzten Erfassung ist alles drin.
export default async function HonorsPage() {
  const { rounds, facts, groups, entryOpen } = await loadHonors();
  const missing = EVENINGS_PER_SEASON - rounds.length;

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-base opacity-70">
          {rounds.length === 0
            ? "Noch keine geschlossene Runde — die Ehrungen füllen sich, sobald eine Erfassung geschlossen ist."
            : `Gezählt: ${rounds.map((r) => `R${r}`).join(", ")}.`}{" "}
          {entryOpen
            ? "Eine Erfassung ist noch offen; ihre Runde zählt erst nach dem Schliessen."
            : missing > 0
              ? `Noch ${missing === 1 ? "eine Runde" : `${missing} Runden`} bis zum Saisonende.`
              : "Die Saison ist vollständig."}
        </p>
        <Link
          href="/admin/ehrungen"
          className="inline-flex min-h-11 items-center justify-center rounded bg-foreground px-4 py-2 text-base font-medium text-background hover:opacity-90 active:opacity-80"
        >
          Präsentation starten
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Die Saison in Zahlen</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-1 border-t border-white/10 pt-3">
              <dt className="order-2 text-base opacity-70">{f.label}</dt>
              <dd className="order-1 text-2xl font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{group.title}</h2>
          <ul className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            {group.honors.map((h) => (
              <li key={h.id} className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <div className="flex flex-col">
                  <h3 className="text-base font-medium">{h.title}</h3>
                  <p className="text-base opacity-60">{h.description}</p>
                </div>
                {h.winners.length === 0 ? (
                  <p className="text-base opacity-60">Noch niemand, wird übersprungen.</p>
                ) : (
                  <EntryList entries={h.winners} />
                )}
                {h.runnersUp.length > 0 && <EntryList entries={h.runnersUp} muted />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
