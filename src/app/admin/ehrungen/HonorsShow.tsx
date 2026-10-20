"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Honor, HonorGroup, SeasonFact } from "@/lib/honors";

/** Abstand, mit dem die Ehrungen einer Folie nacheinander erscheinen. */
const STEP_MS = 1200;
/** Die Geehrten erscheinen so lange nach Titel und Beschreibung. */
const WINNERS_DELAY_MS = 600;

const CONTROL =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-base opacity-40 transition-opacity hover:bg-white/10 hover:opacity-100 focus-visible:opacity-100";

/** Spalten je nach Zahl der Ehrungen einer Folie (feste Klassen für Tailwind). */
const COLUMNS: Record<number, string> = {
  1: "",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

/** Blendet nach `delay` ein, ausser die Folie soll sofort vollständig dastehen. */
function fade(delay: number, instant: boolean) {
  return instant
    ? { className: "" }
    : { className: "motion-safe:animate-reveal", style: { animationDelay: `${delay}ms` } };
}

function Winners({ honor }: { honor: Honor }) {
  const { winners } = honor;
  const sameLabel = winners.every((w) => w.label === winners[0].label);

  // Viele mit demselben Wert (z.B. «Jedes Match gespielt»): Namen in einer Zeile.
  if (winners.length > 3 && sameLabel) {
    return (
      <div className="flex flex-col gap-[0.5vmin]">
        <p className="text-[max(1.125rem,3.4vmin)] font-semibold leading-snug">
          {/* Geschützte Leerzeichen: kein Umbruch mitten im Namen. */}
          {winners.map((w) => w.name.replaceAll(" ", "\u00a0")).join(" · ")}
        </p>
        <p className="text-[max(1rem,2.6vmin)] opacity-60">{winners[0].label}</p>
      </div>
    );
  }

  const large = winners.length <= 2;
  return (
    <ul className="flex flex-col gap-[1vmin]">
      {winners.map((w) => (
        <li key={`${w.playerId}:${w.label}`} className="flex flex-col">
          <span
            className={`font-semibold leading-tight ${
              large ? "text-[max(1.5rem,6vmin)]" : "text-[max(1.25rem,4.4vmin)]"
            }`}
          >
            {w.name}
          </span>
          <span className="text-[max(1rem,2.6vmin)] opacity-60">{w.label}</span>
        </li>
      ))}
    </ul>
  );
}

function StartSlide({ season, facts }: { season: number; facts: SeasonFact[] }) {
  return (
    <div className="flex w-full max-w-[min(100%,160vmin)] flex-col gap-[6vmin]">
      <h1 className="text-[max(2.5rem,11vmin)] font-semibold leading-none">
        Ehrungen {season}
      </h1>
      <dl className="grid grid-cols-2 gap-x-[4vmin] gap-y-[3vmin] md:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-[0.5vmin] border-t border-white/15 pt-[1.5vmin]">
            <dd className="text-[max(1.75rem,8vmin)] font-semibold leading-none tabular-nums">
              {f.value}
            </dd>
            <dt className="order-2 text-[max(1rem,2.8vmin)] opacity-60">{f.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

function GroupSlide({ group, instant }: { group: HonorGroup; instant: boolean }) {
  return (
    <div className="flex w-full max-w-[min(100%,180vmin)] flex-col gap-[5vmin]">
      <h1 className="text-[max(2rem,8vmin)] font-semibold leading-none">{group.title}</h1>
      <ol className={`grid grid-cols-1 gap-x-[4vmin] gap-y-[4vmin] ${COLUMNS[group.honors.length] ?? COLUMNS[3]}`}>
        {group.honors.map((honor, i) => (
          <li
            key={honor.id}
            style={fade(i * STEP_MS, instant).style}
            className={`flex flex-col gap-[2vmin] border-t border-white/15 pt-[2vmin] ${
              fade(i * STEP_MS, instant).className
            }`}
          >
            <div className="flex flex-col gap-[0.5vmin]">
              <h2 className="text-[max(1.125rem,3.8vmin)] font-medium leading-snug">{honor.title}</h2>
              <p className="text-[max(1rem,2.6vmin)] opacity-60">{honor.description}</p>
            </div>
            <div {...fade(i * STEP_MS + WINNERS_DELAY_MS, instant)}>
              <Winners honor={honor} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Präsentation der Ehrungen: eine Folie mit der Saison in Zahlen, dann
 * eine Folie pro Thema. Die Ehrungen einer Folie erscheinen von selbst
 * nacheinander, die Geehrten jeweils kurz nach dem Titel. Ein Klick
 * während des Einblendens zeigt sofort alles, der nächste geht weiter.
 * Tasten: Pfeile, Leertaste, Presenter (Bild ab/auf), «F» für Vollbild.
 * Der Stand steht in der Adresse (#3), ein Neuladen beginnt nicht von vorne.
 */
export default function HonorsShow({
  season,
  facts,
  groups,
}: {
  season: number;
  facts: SeasonFact[];
  groups: HonorGroup[];
}) {
  const last = groups.length; // Folie 0 ist der Start
  const [index, setIndex] = useState(0);
  const [settled, setSettled] = useState<number | null>(null);

  useEffect(() => {
    const fromHash = () => {
      const n = Number(window.location.hash.slice(1));
      return Number.isInteger(n) && n > 0 ? Math.min(n - 1, last) : null;
    };
    const initial = fromHash();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden
    if (initial !== null) setIndex(initial);
    // Von Hand in der Adresse geändert (z.B. #4): dorthin springen.
    const onHashChange = () => {
      const n = fromHash();
      if (n !== null) setIndex(n);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [last]);

  // Wann die aktuelle Folie fertig eingeblendet ist.
  useEffect(() => {
    if (index === 0) return;
    const count = groups[index - 1].honors.length;
    const timer = setTimeout(() => setSettled(index), (count - 1) * STEP_MS + WINNERS_DELAY_MS + 700);
    return () => clearTimeout(timer);
  }, [index, groups]);

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(last, to));
      setIndex(next);
      window.history.replaceState(null, "", `#${next + 1}`);
    },
    [last],
  );

  // Weiter: läuft das Einblenden noch, erst alles zeigen.
  const forward = useCallback(() => {
    if (index > 0 && settled !== index) setSettled(index);
    else go(index + 1);
  }, [index, settled, go]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        forward();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(last);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, go, index, last, toggleFullscreen]);

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
        onClick={forward}
        className="flex min-h-0 flex-1 cursor-pointer justify-center overflow-y-auto px-[max(1rem,6vmin)] py-[3vmin]"
      >
        {/* my-auto zentriert senkrecht, lässt aber scrollen, wenn es nicht passt. */}
        <div key={index} className="my-auto flex w-full justify-center">
          {index === 0 ? (
            <StartSlide season={season} facts={facts} />
          ) : (
            <GroupSlide group={groups[index - 1]} instant={settled === index} />
          )}
        </div>
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
          {index + 1} / {last + 1}
        </span>
        <button
          type="button"
          onClick={forward}
          disabled={index === last && settled === index}
          aria-label="Weiter"
          className={`${CONTROL} disabled:invisible`}
        >
          ›
        </button>
      </div>
    </div>
  );
}
