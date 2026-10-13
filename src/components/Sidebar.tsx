import type { ReactNode } from "react";

/**
 * Seitenleiste mit Einstellungen und Aktionen — gemeinsam für Casual und
 * Liga. Ab lg eine eigene Spalte (1 von 4), die beim Scrollen stehen
 * bleibt und ihren Inhalt vertikal zentriert; darunter stapelt sie unter
 * den Inhalt. Höhe und Abstand rechnen das p-6 des Admin-Layouts heraus,
 * damit sie exakt in den sichtbaren Bereich passt. Wird der Inhalt höher,
 * scrollt die Leiste selbst — «center-safe» verhindert dabei, dass die
 * Zentrierung den oberen Teil unerreichbar abschneidet.
 *
 * Die abgesetzte Fläche (`bg-surface`) zieht die Grenze zum Inhalt —
 * bewusst erst ab lg: darunter gibt es keine zwei Bereiche nebeneinander.
 */
export default function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex flex-col gap-4 lg:col-span-1 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-3rem)] lg:self-start lg:justify-center-safe lg:overflow-y-auto lg:rounded-lg lg:bg-surface lg:px-4 lg:py-6">
      {children}
    </aside>
  );
}
