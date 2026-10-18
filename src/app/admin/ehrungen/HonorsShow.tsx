"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Honor, HonorEntry, SeasonFact } from "@/lib/honors";

type Slide =
  | { kind: "intro" }
  | { kind: "facts" }
  | { kind: "honor"; honor: Honor; number: number; revealed: boolean }
  | { kind: "outro" };

const CONTROL =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-base opacity-40 transition-opacity hover:bg-white/10 hover:opacity-100 focus-visible:opacity-100";

/** Schriftgrösse der Namen: je mehr Geehrte, desto kleiner — nie unter 16px. */
function nameSize(count: number) {
  if (count <= 2) return "text-[max(2rem,8vmin)]";
  if (count <= 4) return "text-[max(1.5rem,5.5vmin)]";
  if (count <= 8) return "text-[max(1.25rem,4vmin)]";
  return "text-[max(1rem,2.8vmin)]";
}

function Winners({ entries }: { entries: HonorEntry[] }) {
  const size = nameSize(entries.length);
  const many = entries.length > 4;
  // Nacheinander einblenden, insgesamt aber nie länger als gut eine Sekunde.
  const step = Math.min(150, 1000 / entries.length);
  return (
    <ul className="flex w-full max-w-[min(100%,180vmin)] flex-wrap items-start justify-center gap-x-[7vmin] gap-y-[3vmin]">
      {entries.map((e, i) => (
        <li
          key={`${e.playerId}:${e.label}`}
          className="flex flex-col items-center gap-[0.5vmin] motion-safe:animate-reveal"
          style={{ animationDelay: `${300 + i * step}ms` }}
        >
          <span className={`${size} font-semibold leading-tight text-amber-300`}>{e.name}</span>
          <span
            className={`tabular-nums opacity-70 ${
              many ? "text-[max(1rem,2.2vmin)]" : "text-[max(1.125rem,3.2vmin)]"
            }`}
          >
            {e.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SlideView({ slide, season, facts, total }: {
  slide: Slide;
  season: number;
  facts: SeasonFact[];
  total: number;
}) {
  if (slide.kind === "intro") {
    return (
      <div className="flex flex-col items-center gap-[2vmin] text-center motion-safe:animate-reveal">
        <p className="text-[max(1.125rem,3.5vmin)] uppercase tracking-[0.3em] opacity-60">
          Commander-Liga {season}
        </p>
        <h1 className="text-[max(3rem,14vmin)] font-semibold leading-none">Ehrungen</h1>
        <p className="text-[max(1rem,2.5vmin)] opacity-50">
          {total === 1 ? "1 Ehrung" : `${total} Ehrungen`}
        </p>
      </div>
    );
  }

  if (slide.kind === "facts") {
    return (
      <div className="flex w-full flex-col items-center gap-[5vmin]">
        <h1 className="text-[max(1.75rem,6vmin)] font-semibold motion-safe:animate-reveal">
          Die Saison in Zahlen
        </h1>
        <dl className="grid w-full max-w-[min(100%,170vmin)] grid-cols-2 gap-[3vmin] md:grid-cols-3">
          {facts.map((f, i) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-[1vmin] text-center motion-safe:animate-reveal"
              style={{ animationDelay: `${200 + i * 200}ms` }}
            >
              <dd className="text-[max(2rem,10vmin)] font-semibold leading-none tabular-nums text-amber-300">
                {f.value}
              </dd>
              <dt className="order-2 text-[max(1rem,2.6vmin)] opacity-70">{f.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (slide.kind === "outro") {
    return (
      <div className="flex flex-col items-center gap-[2vmin] text-center motion-safe:animate-reveal">
        <h1 className="text-[max(2.5rem,11vmin)] font-semibold leading-none">Gratulation!</h1>
        <p className="text-[max(1.125rem,3.5vmin)] opacity-60">Und jetzt: die Rangliste.</p>
      </div>
    );
  }

  const { honor, number, revealed } = slide;
  return (
    <div className="flex w-full flex-col items-center gap-[4vmin] text-center">
      <div className="flex flex-col items-center gap-[1.5vmin]">
        <p className="text-[max(1rem,2.4vmin)] uppercase tracking-[0.3em] opacity-50">
          Ehrung {number} von {total}
        </p>
        <h1
          className={`font-semibold leading-none transition-[font-size] duration-500 ${
            revealed ? "text-[max(2rem,7vmin)]" : "text-[max(2.75rem,12vmin)]"
          }`}
        >
          {honor.title}
        </h1>
        <p className="max-w-[min(100%,150vmin)] text-[max(1.125rem,3.6vmin)] opacity-70">
          {honor.description}
        </p>
      </div>
      {revealed ? (
        <>
          <Winners entries={honor.winners} />
          {honor.runnersUp.length > 0 && (
            <p
              className="text-[max(1rem,2.4vmin)] opacity-50 motion-safe:animate-reveal"
              style={{ animationDelay: `${600 + Math.min(1000, honor.winners.length * 150)}ms` }}
            >
              Dahinter: {honor.runnersUp.map((r) => `${r.name} (${r.label})`).join(" · ")}
            </p>
          )}
        </>
      ) : (
        <p className="text-[max(3rem,14vmin)] font-semibold leading-none opacity-20 motion-safe:animate-pulse">
          ?
        </p>
      )}
    </div>
  );
}

/**
 * Präsentation der Ehrungen: zuerst der Titel, beim nächsten Schritt die
 * Geehrten. Weiter mit Pfeiltaste, Leertaste, Klick oder Presenter
 * (Bild ab); zurück mit Pfeil links. «F» schaltet Vollbild. Der Stand
 * steht in der Adresse (#5), damit ein Neuladen nicht von vorne beginnt.
 */
export default function HonorsShow({
  season,
  facts,
  honors,
}: {
  season: number;
  facts: SeasonFact[];
  honors: Honor[];
}) {
  const slides: Slide[] = [
    { kind: "intro" },
    { kind: "facts" },
    ...honors.flatMap((honor, i): Slide[] => [
      { kind: "honor", honor, number: i + 1, revealed: false },
      { kind: "honor", honor, number: i + 1, revealed: true },
    ]),
    { kind: "outro" },
  ];
  const last = slides.length - 1;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const fromHash = () => {
      const n = Number(window.location.hash.slice(1));
      return Number.isInteger(n) && n > 0 ? Math.min(n - 1, last) : null;
    };
    const initial = fromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden
    if (initial !== null) setIndex(initial);
    // Von Hand in der Adresse geändert (z.B. #15): dorthin springen.
    const onHashChange = () => {
      const n = fromHash();
      if (n !== null) setIndex(n);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [last]);

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(last, to));
      setIndex(next);
      window.history.replaceState(null, "", `#${next + 1}`);
    },
    [last],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, last, toggleFullscreen]);

  const slide = slides[index];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-2 p-2">
        <Link href="/admin/ligaverwaltung/ehrungen" className={CONTROL}>
          ‹ Übersicht
        </Link>
        <button type="button" onClick={toggleFullscreen} className={CONTROL}>
          Vollbild (F)
        </button>
      </div>

      <main
        onClick={() => go(index + 1)}
        className="flex min-h-0 flex-1 cursor-pointer items-center justify-center overflow-y-auto px-[max(1rem,5vmin)] py-[2vmin]"
        aria-live="polite"
      >
        <SlideView
          key={index}
          slide={slide}
          season={season}
          facts={facts}
          total={honors.length}
        />
      </main>

      <div className="flex items-center justify-between gap-2 p-2">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Zurück"
          className={`${CONTROL} disabled:invisible`}
        >
          ‹
        </button>
        <span className="text-base tabular-nums opacity-30">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Weiter"
          className={`${CONTROL} disabled:invisible`}
        >
          ›
        </button>
      </div>
    </div>
  );
}
