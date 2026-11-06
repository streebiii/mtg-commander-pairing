import { SCOPE_LABELS } from "@/lib/achievements";
import type { SheetAchievement } from "@/lib/entrySheet";

export interface SheetPlayer {
  id: string;
  name: string;
  /** Farbidentität in WUBRG-Buchstaben, leer, wenn nicht gesetzt. */
  colors: string;
  url: string;
  /** QR-Code als SVG, vom Server erzeugt; enthält nur die URL. */
  qr: string;
}

type Row = SheetAchievement & { perGame: boolean };

// Masse in mm und pt, damit der Druck genau eine A4-Seite quer füllt
// (297 × 210 mm, 8 mm Rand). Am Bildschirm ist das die Vorschau in
// Originalgrösse; die Schrift ist deshalb kleiner als sonst in der App.
const CELL = "border border-black px-[1.2mm] py-[0.5mm] align-top";
const HEAD = "bg-[#bdbdbd] text-left font-semibold";
const SECTION = "bg-[#555] text-center font-semibold text-white";
const BOX = "w-[10mm] text-center";

function Description({ a }: { a: SheetAchievement }) {
  return (
    <>
      <div className="font-semibold">{a.title}</div>
      {a.description && <div className="whitespace-pre-line">{a.description}</div>}
    </>
  );
}

/** Core oder Rotate: je Achievement eine Zeile mit Kästchen für Spiel 1 und 2. */
function MatchTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[10mm]" />
        <col />
        <col className="w-[21mm]" />
        <col className="w-[10mm]" />
        <col className="w-[10mm]" />
      </colgroup>
      <thead>
        <tr>
          <th className={`${CELL} ${HEAD} text-center`}>Pkt.</th>
          <th className={`${CELL} ${HEAD}`}>Achievement</th>
          <th className={`${CELL} ${HEAD}`}>Abrechnung</th>
          <th className={`${CELL} ${HEAD} text-center`}>R1</th>
          <th className={`${CELL} ${HEAD} text-center`}>R2</th>
        </tr>
        <tr>
          <th colSpan={5} className={`${CELL} ${SECTION}`}>
            {title}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a, i) => (
          <tr key={a.id} className={i % 2 === 1 ? "bg-[#ececec]" : ""}>
            <td className={`${CELL} text-center`}>{a.points}</td>
            <td className={CELL}>
              <Description a={a} />
            </td>
            <td className={CELL}>{SCOPE_LABELS[a.scope]}</td>
            {a.perGame ? (
              <>
                <td className={`${CELL} ${BOX}`} />
                <td className={`${CELL} ${BOX}`} />
              </>
            ) : (
              // Zählt für den ganzen Abend: ein Kästchen über beide Spiele.
              <td colSpan={2} className={`${CELL} ${BOX}`} />
            )}
          </tr>
        ))}
        <tr>
          <td colSpan={3} className={`${CELL} text-right font-semibold`}>
            Total {title}
          </td>
          <td className={`${CELL} ${BOX} h-[6mm]`} />
          <td className={`${CELL} ${BOX}`} />
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Ein persönliches Punkteblatt (SPEC.md Abschnitt 12.1), nach dem Muster
 * des Papierblatts der Liga, in zwei gleichen Hälften zum Falten: links
 * Core und Rotate mit Kästchen für Spiel 1 und 2, rechts Deckbau und
 * darunter der QR-Code mit der Anleitung. Name, Datum und Farben sind vorgedruckt, den Commander trägt
 * der Spieler von Hand ein.
 */
export default function Sheet({
  player,
  day,
  core,
  rotate,
  deckbau,
}: {
  player: SheetPlayer;
  day: string;
  core: Row[];
  rotate: Row[];
  deckbau: SheetAchievement[];
}) {
  return (
    // Am Bildschirm ein ganzes A4-Blatt mit Rand, im Druck nur die
    // bedruckbare Fläche (die Seite hat 8 mm Rand auf allen Seiten).
    <article className="h-[210mm] w-[297mm] shrink-0 bg-white p-[8mm] text-[8pt] leading-[1.2] text-black [print-color-adjust:exact] print:h-[194mm] print:w-[281mm] print:p-0 print:not-last:break-after-page">
      {/* Zwei gleich breite Hälften, damit sich das Blatt genau in der
          Mitte falten lässt: links Core und Rotate, rechts Deckbau und
          QR-Code. Die Faltkante liegt mitten im Abstand dazwischen. Ohne
          feste Höhe ist die Zeile so hoch wie die linke Spalte — der
          QR-Kasten rechts endet damit auf derselben Höhe. */}
      <div className="flex max-h-full gap-[8mm] overflow-hidden">

        <div className="flex min-w-0 flex-1 flex-col gap-[2.5mm]">
          <header className="flex items-end gap-[4mm] text-[10.5pt]">
            <div className="flex flex-1 items-end gap-[2mm]">
              <span>Name</span>
              <span className="flex-1 border-b border-black pb-[0.5mm] text-[12pt] font-semibold">
                {player.name}
              </span>
            </div>
            <div className="flex items-end gap-[2mm]">
              <span>Datum</span>
              <span className="w-[24mm] border-b border-black pb-[0.5mm] font-semibold">
                {day}
              </span>
            </div>
          </header>
          <MatchTable title="Core" rows={core} />
          {rotate.length > 0 && <MatchTable title="Rotate" rows={rotate} />}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[2.5mm]">
          <header className="flex items-end gap-[4mm] text-[10.5pt]">
            <div className="flex flex-1 items-end gap-[2mm]">
              <span>Commander</span>
              <span className="flex-1 border-b border-black pb-[0.5mm]">&nbsp;</span>
            </div>
            <div className="flex items-end gap-[2mm]">
              <span>Color-ID</span>
              <span className="w-[16mm] border-b border-black pb-[0.5mm] font-semibold">
                {player.colors || "\u00a0"}
              </span>
            </div>
          </header>
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[10mm]" />
              <col />
              <col className="w-[21mm]" />
              <col className="w-[10mm]" />
            </colgroup>
            <thead>
              <tr>
                <th className={`${CELL} ${HEAD} text-center`}>Pkt.</th>
                <th className={`${CELL} ${HEAD}`}>Achievement</th>
                <th className={`${CELL} ${HEAD}`}>Abrechnung</th>
                <th className={`${CELL} ${HEAD} text-center`}>✓</th>
              </tr>
              <tr>
                <th colSpan={4} className={`${CELL} ${SECTION}`}>
                  Deckbau
                </th>
              </tr>
            </thead>
            <tbody>
              {deckbau.map((a, i) => (
                <tr key={a.id} className={i % 2 === 1 ? "bg-[#ececec]" : ""}>
                  <td className={`${CELL} text-center`}>{a.points}</td>
                  <td className={CELL}>
                    <Description a={a} />
                  </td>
                  <td className={CELL}>{SCOPE_LABELS[a.scope]}</td>
                  <td className={`${CELL} ${BOX}`} />
                </tr>
              ))}
              <tr>
                <td colSpan={3} className={`${CELL} text-right font-semibold`}>
                  Total Deckbau
                </td>
                <td className={`${CELL} ${BOX} h-[6mm]`} />
              </tr>
            </tbody>
          </table>

          <div className="mt-auto flex items-stretch gap-[4mm] border border-black p-[3mm]">
            <div
              className="h-[34mm] w-[34mm] shrink-0 [&>svg]:h-full [&>svg]:w-full"
              // QR-Code als SVG vom Server erzeugt, enthält nur die URL.
              dangerouslySetInnerHTML={{ __html: player.qr }}
            />
            <div className="flex min-w-0 flex-col gap-[1.5mm]">
              <div className="text-[10.5pt] font-semibold">So geht&apos;s</div>
              <ol className="flex list-decimal flex-col gap-[0.8mm] pl-[4mm]">
                <li>
                  Melde dich an, indem du den QR-Code scannst und deine
                  Deckbau-Achievements eingibst. (Evergreen kann am Finale
                  eingegeben werden.)
                </li>
                <li>Auf der Seite siehst du, an welchem Tisch du spielen wirst.</li>
                <li>
                  Nach dem Spiel können die Punkte direkt unter dem QR-Code
                  eingegeben werden.
                </li>
                <li>Für Runde 2 wiederholen.</li>
              </ol>
              <div className="mt-auto break-all text-[7pt] text-black/60">{player.url}</div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
