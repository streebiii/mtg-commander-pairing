import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { loadPublicNames } from "@/lib/publicRoster";
import { ensureSheets, findSheetEvening, toSheetAchievement } from "@/lib/entries";
import { isPerGame, visibleAchievements } from "@/lib/entrySheet";
import { eveningLabel, isLastEvening } from "@/lib/season";
import Sheet, { type SheetPlayer } from "./Sheet";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// Druckvorlage der persönlichen Punkteblätter (SPEC.md Abschnitt 12.1):
// je Liga-Teilnehmenden ein A4-Blatt quer nach dem Muster des
// Papierblatts, mit Name, Datum, Farben und einem QR-Code, der nur für
// diesen Abend gilt. Alle Blätter auf einer Seite — «Drucken» → «Als PDF
// sichern» ergibt ein PDF mit allen. Mit `?spieler=<id>` nur eines, z.B.
// für ein verlorenes Blatt oder wen, der neu dazukommt.
export default async function SheetsPage({
  searchParams,
}: PageProps<"/admin/ligaverwaltung/punkteblaetter">) {
  const { spieler } = await searchParams;
  const only = typeof spieler === "string" && spieler ? spieler : null;

  const evening = await findSheetEvening();
  if (!evening) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-medium">Punkteblätter</h2>
        <p className="text-base opacity-70">
          Gerade ist kein Abend vorbereitet. Bereite ihn im Liga-Tab vor,
          dann lassen sich hier die Punkteblätter drucken.
        </p>
        <Link
          href="/admin/league"
          className="inline-flex min-h-11 items-center self-start underline-offset-2 hover:underline"
        >
          Zum Liga-Tab ›
        </Link>
      </div>
    );
  }

  // Wer seit dem Vorbereiten an der Liga teilnimmt, bekommt hier sein Blatt.
  await ensureSheets(evening.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "pairings.mtgbl.ch";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [entries, achievements, names] = await Promise.all([
    prisma.playerEntry.findMany({
      where: {
        eveningId: evening.id,
        sheetCode: { not: null },
        player: { leagueActive: true, archivedAt: null },
      },
      include: { player: true },
    }),
    prisma.eveningAchievement.findMany({
      where: { eveningId: evening.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    // Wie auf den öffentlichen Seiten Vorname und Initial — die Blätter
    // liegen offen auf den Tischen.
    loadPublicNames(),
  ]);
  const lastEvening = isLastEvening(evening.date);
  const list = visibleAchievements(achievements.map(toSheetAchievement), lastEvening);
  const core = list.filter((a) => a.category === "FIXED");
  const rotate = list.filter((a) => a.category === "ROTATING");
  // Evergreen zum Schluss, wie auf dem Papierblatt.
  const deckbau = list
    .filter((a) => a.category === "DECKBUILDING")
    .sort((x, y) => Number(x.scope === "SEASON") - Number(y.scope === "SEASON"));

  const sorted = entries
    .map((e) => ({ entry: e, name: names.get(e.playerId) ?? e.player.firstName }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
  const shown = only ? sorted.filter((s) => s.entry.playerId === only) : sorted;

  const day = evening.date.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const sheets: SheetPlayer[] = await Promise.all(
    shown.map(async ({ entry, name }) => {
      const url = `${origin}/blatt/${entry.sheetCode}`;
      const qr = await QRCode.toString(url, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return {
        id: entry.playerId,
        name,
        colors: entry.player.colorIdentity ?? "",
        url,
        qr,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Nur diese Seite druckt quer und mit schmalerem Rand. */}
      <style>{"@page { size: A4 landscape; margin: 8mm; }"}</style>
      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">
            Punkteblätter · {eveningLabel(evening.date)} · {day}
          </h2>
          <p className="max-w-3xl text-base opacity-70">
            {only
              ? "Ein einzelnes Blatt."
              : `${sheets.length} Blätter, eines pro Liga-Teilnehmenden, A4 quer.`}{" "}
            Die QR-Codes gelten nur für diesen Abend. Im Druckdialog «Als PDF
            sichern» wählen, um ein PDF zu erhalten.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <PrintButton />
          {/* Ein einzelnes Blatt, z.B. für ein verlorenes. Ein GET-Formular,
              damit es ohne JavaScript und ohne Zustand auskommt. */}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-base">
              Nur ein Blatt
              <select
                name="spieler"
                defaultValue={only ?? ""}
                className="min-h-11 rounded border border-white/20 bg-transparent px-3 py-2 text-base"
              >
                <option value="">Alle Spieler</option>
                {sorted.map(({ entry, name }) => (
                  <option key={entry.playerId} value={entry.playerId}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded border border-white/20 px-4 py-2 text-base font-medium hover:bg-white/5"
            >
              Anzeigen
            </button>
          </form>
        </div>
      </div>

      {/* Vorschau am Bildschirm in Originalgrösse; breiter als das Fenster
          lässt sie sich seitlich schieben. */}
      <div className="flex flex-col gap-6 overflow-x-auto print:block print:overflow-visible">
        {sheets.map((p) => (
          <Sheet
            key={p.id}
            player={p}
            day={day}
            core={core.map((a) => ({ ...a, perGame: isPerGame(a.scope) }))}
            rotate={rotate.map((a) => ({ ...a, perGame: isPerGame(a.scope) }))}
            deckbau={deckbau}
          />
        ))}
      </div>
    </div>
  );
}
