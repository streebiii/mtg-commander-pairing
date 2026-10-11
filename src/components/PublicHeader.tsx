import Image from "next/image";
import Link from "next/link";

const PAGES = [
  { key: "pairings", href: "/", label: "Pairings" },
  { key: "rangliste", href: "/rangliste", label: "Rangliste" },
] as const;

/**
 * Kopf der öffentlichen Seiten: Vereinslogo und die Umschaltung zwischen
 * Pairings und Rangliste (siehe SPEC.md Abschnitt 13).
 */
export default function PublicHeader({
  active,
}: {
  active: (typeof PAGES)[number]["key"];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Vereinslogo von mtgbl.ch. Der Bär ist schwarz auf transparentem
            Grund und wird invertiert, damit er auf dem dunklen Hintergrund
            sichtbar bleibt. */}
        <Image
          src="/logo.png"
          alt="MTG Baselland"
          width={213}
          height={191}
          priority
          className="h-10 w-auto invert"
        />
        <h1 className="text-2xl font-semibold">
          {PAGES.find((p) => p.key === active)!.label}
        </h1>
      </div>
      <nav className="flex rounded border border-white/20 p-0.5 text-sm font-medium">
        {PAGES.map((page) => (
          <Link
            key={page.key}
            href={page.href}
            aria-current={page.key === active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-sm px-4 transition-colors ${
              page.key === active
                ? "bg-foreground text-background"
                : "opacity-70 hover:bg-white/5 hover:opacity-100"
            }`}
          >
            {page.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
