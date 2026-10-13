import LigaTabs from "./LigaTabs";

// Ligaverwaltung (SPEC.md Abschnitt 14): die aktuelle Runde, alle Runden,
// der Achievement-Katalog und die Tischkarten — alles, was die Liga
// ausserhalb des Spielabends selbst braucht.
export default function LigaverwaltungLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 print:hidden">
        <h1 className="text-xl font-semibold">Ligaverwaltung</h1>
        <LigaTabs />
      </div>
      {children}
    </div>
  );
}
