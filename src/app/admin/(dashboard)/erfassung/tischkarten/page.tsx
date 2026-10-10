import { headers } from "next/headers";
import QRCode from "qrcode";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

/** Tische im Vereinslokal — so viele Karten werden gedruckt. */
const TABLE_COUNT = 6;

// Druckvorlage der Tischkarten (siehe SPEC.md Abschnitt 12): je Tisch ein
// QR-Code auf /tisch/<nr>. Einmal gedruckt bleiben sie gültig, weil der
// QR nur den Tisch enthält, nicht den Abend. «Drucken» → «Als PDF
// sichern» ergibt das PDF.
export default async function TableCardsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "pairings.mtgbl.ch";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const cards = await Promise.all(
    Array.from({ length: TABLE_COUNT }, async (_, i) => {
      const nr = i + 1;
      const url = `${origin}/tisch/${nr}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { nr, url, svg };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold">Tischkarten</h1>
          <p className="text-sm opacity-70">
            Einmal drucken, sie bleiben gültig. Im Druckdialog «Als PDF
            sichern» wählen, um ein PDF zu erhalten.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Druckfläche: 2 × 3 Karten auf einer A4-Seite, schwarz auf weiss. */}
      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 print:max-w-none print:grid-cols-2 print:gap-0">
        {cards.map((c) => (
          <div
            key={c.nr}
            className="flex flex-col items-center gap-3 rounded border border-white/20 bg-white p-6 text-center text-black print:h-[95mm] print:break-inside-avoid print:rounded-none print:border-dashed print:border-black/30"
          >
            <div className="text-3xl font-semibold">Tisch {c.nr}</div>
            <div
              className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
              // QR-Code als SVG vom Server erzeugt, enthält nur die URL.
              dangerouslySetInnerHTML={{ __html: c.svg }}
            />
            <div className="text-sm font-medium">Achievements erfassen</div>
            <div className="text-xs text-black/70">
              QR-Code scannen und deinen Namen antippen
            </div>
            <div className="text-[11px] text-black/50">{c.url}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
