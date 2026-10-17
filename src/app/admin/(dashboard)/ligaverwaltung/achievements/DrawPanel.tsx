"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { ROTATING_DRAW_SIZE, formatPoints } from "@/lib/achievements";
import { shuffle } from "@/lib/pairing/shuffle";
import { activateRotatingDraw } from "./actions";
import type { TableAchievement } from "./AchievementTable";

/** Zieht zufällig ROTATING_DRAW_SIZE aus allen rotierenden. */
function draw(pool: TableAchievement[]): TableAchievement[] {
  return shuffle(pool)
    .slice(0, ROTATING_DRAW_SIZE)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Eine Zeile pro Achievement — so lässt es sich auf mtgbl.ch eintragen. */
function asText(drawn: TableAchievement[]): string {
  return drawn
    .map((a) => `${a.title} (${formatPoints(a.points)})${a.description ? `: ${a.description}` : ""}`)
    .join("\n");
}

/**
 * Auslosung der rotierenden Achievements für die nächste Runde (SPEC.md
 * Abschnitt 11.2). Gezogen wird aus allen rotierenden, auch den gerade
 * aktiven. Erst eine Vorschau, die sich neu ziehen lässt; «Übernehmen»
 * stellt die gezogenen aktiv und alle übrigen rotierenden inaktiv. Danach
 * steht die Liste zum Kopieren bereit — mtgbl.ch übernimmt die Ziehung
 * der App.
 *
 * Seitenpanel wie «Neues Achievement»: Esc, Klick auf den Hintergrund
 * oder × schliessen.
 */
export default function DrawPanel({
  pool,
  onClose,
}: {
  pool: TableAchievement[];
  onClose: () => void;
}) {
  const [drawn, setDrawn] = useState(() => draw(pool));
  const [adopted, setAdopted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Über eine Ref, damit der Effekt nur beim Öffnen läuft.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    // Hintergrund nicht mitscrollen, solange das Panel offen ist.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  function adopt() {
    setError(null);
    startTransition(async () => {
      const ok = await activateRotatingDraw(drawn.map((a) => a.id));
      if (ok) setAdopted(true);
      else setError("Konnte nicht übernommen werden — Seite neu laden und nochmals versuchen.");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText(drawn));
      setCopied(true);
    } catch {
      // Ohne Zugriff auf die Zwischenablage: Text markieren, dann kopiert
      // man ihn von Hand.
      textRef.current?.select();
      setCopyBlocked(true);
    }
  }

  const titleId = "draw-panel-title";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      {/* Am rechten Rand der Box (max-w-app), nicht des Bildschirms —
          auf einem 49-Zoll-Monitor sässe es sonst weit weg vom Inhalt. */}
      <div className="pointer-events-none relative mx-auto flex h-full max-w-app justify-end">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto relative flex h-full w-full flex-col border-l border-white/10 bg-surface shadow-2xl sm:max-w-md"
        >
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <h2 id={titleId} className="text-lg font-medium">
              {adopted ? "Ziehung übernommen" : "Rotierende auslosen"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schliessen"
              className="flex min-h-11 min-w-11 items-center justify-center rounded text-xl hover:bg-white/10"
            >
              ×
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 text-base">
            {adopted ? (
              <>
                <p>
                  Diese {drawn.length} sind jetzt aktiv, alle anderen rotierenden
                  inaktiv. Sie gelten ab der nächsten Runde. Trage sie jetzt auf
                  mtgbl.ch ein:
                </p>
                <textarea
                  ref={textRef}
                  readOnly
                  rows={12}
                  value={asText(drawn)}
                  aria-label="Ziehung als Text"
                  className="w-full rounded border border-white/20 bg-transparent px-3 py-2"
                />
                {copyBlocked && (
                  <p role="status" className="opacity-70">
                    Der Browser lässt nicht direkt kopieren — der Text ist markiert,
                    kopiere ihn von Hand.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="opacity-70">
                  Zufällig {ROTATING_DRAW_SIZE} aus allen {pool.length} rotierenden.
                  Erst «Übernehmen» stellt sie aktiv und die bisherigen inaktiv.
                </p>
                <ol className="flex flex-col gap-2">
                  {drawn.map((a) => (
                    <li key={a.id} className="rounded border border-white/10 px-3 py-2">
                      <span className="font-medium">{a.title}</span>{" "}
                      <span className="opacity-60">{formatPoints(a.points)}</span>
                      {a.description && (
                        <span className="block whitespace-pre-line opacity-60">
                          {a.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {error && (
              <p role="alert" className="text-base text-red-400">
                {error}
              </p>
            )}
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
            {adopted ? (
              <>
                <SecondaryButton onClick={onClose}>Schliessen</SecondaryButton>
                <PrimaryButton onClick={copy}>{copied ? "Kopiert ✓" : "Liste kopieren"}</PrimaryButton>
              </>
            ) : (
              <>
                <SecondaryButton onClick={() => setDrawn(draw(pool))} disabled={isPending}>
                  Neu ziehen
                </SecondaryButton>
                <PrimaryButton onClick={adopt} loading={isPending}>
                  {isPending ? "Übernehme…" : "Übernehmen"}
                </PrimaryButton>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
