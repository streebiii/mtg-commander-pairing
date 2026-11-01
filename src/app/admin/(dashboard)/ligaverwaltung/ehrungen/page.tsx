import { loadHonors } from "@/lib/honorsData";
import { EVENINGS_PER_SEASON } from "@/lib/season";

export const dynamic = "force-dynamic";

// Reiter «Ehrungen» der Ligaverwaltung (SPEC.md Abschnitt 15): die lustigen
// Statistiken für die Rangverkündigung als schlichte Liste. Rechnet bei
// jedem Aufruf neu — nach dem Schliessen der letzten Erfassung ist alles
// drin.
export default async function HonorsPage() {
  const { rounds, groups, entryOpen } = await loadHonors();
  const missing = EVENINGS_PER_SEASON - rounds.length;
  // Ehrungen ohne Geehrte fallen weg, Themen ohne Ehrung ebenso.
  const shown = groups
    .map((g) => ({ ...g, honors: g.honors.filter((h) => h.winners.length > 0) }))
    .filter((g) => g.honors.length > 0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <p className="text-base opacity-70">
        {rounds.length === 0
          ? "Noch keine geschlossene Runde — die Ehrungen füllen sich, sobald eine Erfassung geschlossen ist."
          : `Gezählt: ${rounds.map((r) => `R${r}`).join(", ")}.`}{" "}
        {entryOpen
          ? "Eine Erfassung ist noch offen; ihre Runde zählt erst nach dem Schliessen."
          : missing > 0
            ? `Noch ${missing === 1 ? "eine Runde" : `${missing} Runden`} bis zum Saisonende.`
            : "Die Saison ist vollständig."}
      </p>

      {shown.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{group.title}</h2>
          <ul className="flex flex-col">
            {group.honors.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-white/10 py-2"
              >
                <span className="flex flex-col">
                  <span>{h.title}</span>
                  <span className="opacity-60">{h.description}</span>
                </span>
                <span className="flex flex-col sm:items-end">
                  {h.winners.map((e) => (
                    <span key={`${e.playerId}:${e.label}`}>
                      <span className="font-medium">{e.name}</span>{" "}
                      <span className="tabular-nums opacity-70">{e.label}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
