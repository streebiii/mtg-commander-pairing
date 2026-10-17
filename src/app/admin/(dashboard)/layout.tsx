import AdminNav from "./AdminNav";

/**
 * Rahmen des Organisator-Bereichs. Auf grossen Bildschirmen (bis 49 Zoll)
 * höchstens `max-w-app` breit und zentriert; ab `boxed:` als Box mit Rand
 * vor dunklerem Grund. Darunter füllt er die Breite wie bisher.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen boxed:bg-outside print:bg-transparent">
      <div className="mx-auto min-h-screen w-full max-w-app bg-background boxed:border-x boxed:border-white/10 print:max-w-none print:border-0">
        <header className="border-b border-white/10 px-4 py-2 sm:py-4 print:hidden">
          <AdminNav />
        </header>
        <main className="p-6 print:p-0">{children}</main>
      </div>
    </div>
  );
}
