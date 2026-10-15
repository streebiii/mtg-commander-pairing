"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Feste Leiste am unteren Bildschirmrand mit der Hauptaktion — nur
 * unterhalb von lg, wo die Seitenleiste unter den Inhalt rutscht. Ohne sie
 * lag «Tische berechnen» bzw. «Nächstes Match starten» auf dem Handy erst
 * nach der ganzen Spielerliste, zwei Bildschirme weiter unten.
 *
 * Der Abstandhalter davor ist so hoch wie die Leiste selbst, damit das
 * Ende der Seite nicht darunter verschwindet — auch wenn sie wächst, etwa
 * mit einer Rückfrage. Was hier steht, blendet die Seitenleiste unterhalb
 * von lg aus (`hidden lg:flex`), sonst stünde es am Seitenende doppelt.
 */
export default function MobileActionBar({ children }: { children: ReactNode }) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => setHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="h-28 lg:hidden print:hidden"
        style={height !== null ? { height } : undefined}
      />
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">{children}</div>
      </div>
    </>
  );
}
