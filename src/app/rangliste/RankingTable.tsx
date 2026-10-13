"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import ColorDots from "@/components/ColorDots";
import type { Breakdown } from "@/lib/entrySheet";
import type { RankingRow, RoundCell } from "@/lib/ranking";

/** Abstand vom Rand und zur Zahl, in px. */
const GAP = 8;
/** Dauer der Bottom-Sheet-Animation, passend zu `duration-250`. */
const SHEET_MS = 250;


interface Detail {
  round: number;
  name: string;
  cell: RoundCell & { breakdown: Breakdown };
}

/**
 * Kann das Gerät hovern (Maus, Trackpad)? Dann zeigt ein Popover die
 * Details, sonst ein Bottom Sheet (SPEC.md Abschnitt 13). Bewusst nach
 * Fähigkeit statt Bildschirmbreite: ein Tablet mit Touch bekommt das Sheet.
 */
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
function useCanHover(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(HOVER_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(HOVER_QUERY).matches,
    () => false,
  );
}

export default function RankingTable({
  rows,
  appDates,
}: {
  rows: RankingRow[];
  /** Datum der Abende aus der App je Spalte, schon formatiert. */
  appDates: Record<number, string>;
}) {
  const canHover = useCanHover();
  const [popover, setPopover] = useState<(Detail & { anchor: HTMLElement }) | null>(null);
  const [sheet, setSheet] = useState<(Detail & { trigger: HTMLElement }) | null>(null);
  const roundCount = rows[0]?.rounds.length ?? 0;
  // Stabil, damit das offene Sheet seinen Effect nicht neu startet.
  const closeSheet = useCallback(() => setSheet(null), []);
  const closePopover = useCallback(() => setPopover(null), []);

  function showDetail(detail: Detail, target: HTMLElement, via: "hover" | "tap") {
    if (via === "hover") setPopover({ ...detail, anchor: target });
    else setSheet({ ...detail, trigger: target });
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="border-separate border-spacing-0 text-base tabular-nums">
          <thead>
            <tr className="text-left">
              <th className={`${STICKY.rank} ${HEAD}`}>#</th>
              <th className={`${STICKY.name} ${HEAD}`}>Spieler</th>
              <th className={`${STICKY.total} ${HEAD} text-right`}>Total</th>
              {Array.from({ length: roundCount }, (_, i) => (
                <th key={i} className={`${HEAD} min-w-12 text-right`}>
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={`${STICKY.rank} ${CELL}`}>
                  <span className="inline-flex items-baseline gap-1.5">
                    {row.rank}
                    <Delta delta={row.delta} />
                  </span>
                </td>
                <td className={`${STICKY.name} ${CELL}`}>
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate">{row.name}</span>
                    <ColorDots identity={row.colorIdentity} />
                    {row.decklistUrl && (
                      <DecklistLink url={row.decklistUrl} name={row.name} />
                    )}
                  </span>
                </td>
                <td className={`${STICKY.total} ${CELL} text-right font-semibold`}>
                  {row.total}
                </td>
                {row.rounds.map((cell, i) => (
                  <td key={i} className={`${CELL} text-right`}>
                    <RoundValue
                      cell={cell}
                      label={`R${i + 1} von ${row.name}`}
                      canHover={canHover}
                      onShow={(target, via) =>
                        cell.breakdown &&
                        showDetail(
                          { round: i + 1, name: row.name, cell: { ...cell, breakdown: cell.breakdown } },
                          target,
                          via,
                        )
                      }
                      onHide={closePopover}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popover && (
        <Popover anchor={popover.anchor} onClose={closePopover}>
          <DetailView detail={popover} date={appDates[popover.round]} />
        </Popover>
      )}
      {sheet && (
        <BottomSheet trigger={sheet.trigger} onClosed={closeSheet}>
          <DetailView detail={sheet} date={appDates[sheet.round]} />
        </BottomSheet>
      )}
    </>
  );
}

// Rang mit Δ, Spieler und Total bleiben beim horizontalen Scrollen stehen;
// die Abstände links entsprechen den Breiten der Spalten davor.
const STICKY = {
  rank: "sticky left-0 z-10 w-12 min-w-12 bg-background",
  name: "sticky left-12 z-10 w-32 min-w-32 max-w-32 bg-background sm:w-40 sm:min-w-40 sm:max-w-40",
  total: "sticky left-44 z-10 w-14 min-w-14 border-r border-white/10 bg-background pr-3 sm:left-52",
};
// Abgedunkelt über die Schriftfarbe, nicht `opacity`: sonst würde auch der
// Hintergrund der fixierten Zellen durchsichtig und die Spalten dahinter
// schienen beim Scrollen durch.
const HEAD = "border-b border-white/10 px-2 py-2.5 font-medium text-foreground/70";
const CELL = "border-b border-white/5 px-2 py-2";

function Delta({ delta }: { delta: RankingRow["delta"] }) {
  if (delta === "neu") return <span className="text-base text-blue-400">neu</span>;
  if (!delta) return null;
  return delta > 0 ? (
    <span className="text-base text-green-400" aria-label={`${delta} Ränge gewonnen`}>
      ▲{delta}
    </span>
  ) : (
    <span className="text-base text-red-400" aria-label={`${-delta} Ränge verloren`}>
      ▼{-delta}
    </span>
  );
}

/**
 * Icon-Link zur Deckliste eines Spielers, öffnet in einem neuen Tab. Die
 * Adresse ist beim Speichern auf http(s) geprüft (normalizeDecklistUrl);
 * `noopener noreferrer`, damit die fremde Seite nicht auf die Rangliste
 * zugreifen kann.
 */
function DecklistLink({ url, name }: { url: string; name: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Deckliste (neuer Tab)"
      aria-label={`Deckliste von ${name} (öffnet in neuem Tab)`}
      className="-my-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded opacity-70 hover:bg-white/10 hover:opacity-100"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    </a>
  );
}

/**
 * Punkte eines Abends. Nur Abende aus der App haben Details — sie sind
 * unterstrichen und reagieren auf Hover bzw. Antippen.
 */
function RoundValue({
  cell,
  label,
  canHover,
  onShow,
  onHide,
}: {
  cell: RoundCell;
  label: string;
  canHover: boolean;
  onShow: (target: HTMLElement, via: "hover" | "tap") => void;
  onHide: () => void;
}) {
  const struck = cell.struck ? "line-through opacity-50" : "";
  if (cell.points === null) {
    return <span className={`opacity-40 ${struck}`}>–</span>;
  }
  if (!cell.breakdown) return <span className={struck}>{cell.points}</span>;

  return (
    <button
      type="button"
      aria-label={`${label}: ${cell.points} Punkte, Details anzeigen`}
      aria-haspopup="dialog"
      className={`-my-1 min-h-9 min-w-9 rounded px-1 text-right decoration-dotted underline-offset-4 hover:bg-white/5 ${
        cell.struck ? struck : "underline"
      }`}
      onMouseEnter={(e) => canHover && onShow(e.currentTarget, "hover")}
      onMouseLeave={() => canHover && onHide()}
      onFocus={(e) => canHover && onShow(e.currentTarget, "hover")}
      onBlur={() => canHover && onHide()}
      onClick={(e) => !canHover && onShow(e.currentTarget, "tap")}
    >
      {cell.points}
    </button>
  );
}

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

/**
 * Inhalt von Popover und Bottom Sheet: zuerst, wer und welcher Abend, mit
 * dem Total gross daneben; darunter je Abschnitt (Spiel 1, Spiel 2, Ganzer
 * Abend) ein kleiner Zwischentitel mit Teilsumme und die Achievements mit
 * ihren Punkten in einer bündigen Spalte rechts.
 */
function DetailView({ detail, date }: { detail: Detail; date: string | undefined }) {
  const { cell } = detail;
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4 pb-3">
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{detail.name}</div>
          <div className="text-base opacity-70">
            R{detail.round}
            {date && ` · ${date}`}
          </div>
          {cell.struck && (
            <div className="mt-1 text-base text-amber-400">Streichresultat — zählt nicht</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-2xl leading-none font-semibold tabular-nums ${cell.struck ? "line-through opacity-50" : ""}`}>
            {cell.breakdown.total}
          </div>
          <div className="mt-1 text-base opacity-70">Punkte</div>
        </div>
      </div>

      {cell.breakdown.sections.map((section) => (
        <section key={section.label} className="border-t border-white/10 py-3 last:pb-0">
          <h3 className="mb-1.5 flex justify-between gap-4 text-base font-medium opacity-70">
            <span>{section.label}</span>
            <span className="tabular-nums">{section.total}</span>
          </h3>
          <ul className="flex flex-col gap-1 text-base">
            {section.items.map((item) => (
              <li key={item.title} className="flex items-baseline justify-between gap-4">
                <span className="leading-snug">
                  {item.title}
                  {item.count > 1 && (
                    <span className="ml-1.5 text-base opacity-60">
                      {item.count} × {formatPoints(item.points)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPoints(item.points * item.count)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Desktop: kleines Fenster direkt an der Zahl. Liegt per Portal über der
 * Seite, damit es nicht vom horizontal scrollbaren Tabellenrahmen
 * abgeschnitten wird; passt es unten nicht hin, erscheint es darüber.
 */
function Popover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Bevorzugt unter der Zahl, sonst darüber. Ist das Fenster für beides zu
  // hoch (ein Abend mit vielen Achievements), steht es seitlich daneben —
  // es soll die Zahl, auf die man zeigt, nie verdecken.
  useLayoutEffect(() => {
    const box = ref.current!.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clamp = (value: number, max: number) => Math.min(Math.max(GAP, value), max);

    if (target.bottom + GAP + box.height <= vh - GAP) {
      setPosition({
        top: target.bottom + GAP,
        left: clamp(target.left + target.width / 2 - box.width / 2, vw - box.width - GAP),
      });
    } else if (target.top - GAP - box.height >= GAP) {
      setPosition({
        top: target.top - GAP - box.height,
        left: clamp(target.left + target.width / 2 - box.width / 2, vw - box.width - GAP),
      });
    } else {
      const right = target.right + GAP;
      setPosition({
        top: clamp(target.top + target.height / 2 - box.height / 2, vh - box.height - GAP),
        left: right + box.width <= vw - GAP ? right : Math.max(GAP, target.left - GAP - box.width),
      });
    }
  }, [anchor]);

  // Beim Scrollen bliebe das Fenster sonst stehen, während die Zahl wegwandert.
  useEffect(() => {
    window.addEventListener("scroll", onClose, true);
    return () => window.removeEventListener("scroll", onClose, true);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: `calc(100vh - ${2 * GAP}px)`,
      }}
      className={`pointer-events-none fixed z-50 w-80 overflow-hidden rounded-lg border border-white/15 bg-surface p-4 shadow-xl shadow-black/50 transition-opacity duration-150 motion-reduce:transition-none ${
        position ? "opacity-100" : "opacity-0"
      }`}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Touch: fährt sanft von unten hoch, die Seite dahinter wird abgedunkelt.
 * Schliesst mit Tippen daneben, mit ×, mit Escape und mit der
 * Zurück-Geste — dafür bekommt das offene Sheet einen eigenen Eintrag im
 * Browser-Verlauf.
 */
function BottomSheet({
  trigger,
  onClosed,
  children,
}: {
  trigger: HTMLElement;
  onClosed: () => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Erst im nächsten Frame einblenden, damit die Animation startet.
    const frame = requestAnimationFrame(() => setVisible(true));
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    // Im Entwicklungsmodus läuft der Effect doppelt — nur einen Eintrag anlegen.
    if (!history.state?.rankingSheet) history.pushState({ rankingSheet: true }, "");

    let closing = false;
    const finish = () => {
      if (closing) return;
      closing = true;
      setVisible(false);
      window.setTimeout(() => {
        document.body.style.overflow = "";
        trigger.focus();
        onClosed();
      }, SHEET_MS);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && history.back();
    window.addEventListener("popstate", finish);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", finish);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [trigger, onClosed]);

  // Schliessen geht immer über den Verlauf, damit der Eintrag des Sheets
  // wieder verschwindet; das löst `popstate` und damit `finish` aus.
  const close = () => history.back();

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Achievements der Runde">
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-250 motion-reduce:transition-none ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-surface px-5 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-250 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Griff und × teilen sich eine Zeile über dem Inhalt — so hat der
            Inhalt die volle Breite, und die Punktespalte schliesst bündig
            mit dem Rand ab. */}
        <div className="relative mb-1 flex h-11 items-center justify-center">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-white/30" />
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Schliessen"
            className="absolute top-0 -right-2 flex h-11 w-11 items-center justify-center rounded text-xl opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
