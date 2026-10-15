"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Wie oft die offene Seite nachfragt, ob sich etwas geändert hat. */
const CHECK_INTERVAL_MS = 10_000;

/**
 * Lädt die öffentliche Pairing-Seite neu, sobald sich an der Zuteilung
 * etwas ändert — sonst nie. Ein Bildschirm vor Ort oder ein Handy zeigt
 * damit ohne Zutun das aktuelle Match.
 *
 * Gefragt wird nur nach einem kurzen Fingerabdruck (`/stand`); die Seite
 * selbst wird nur bei einer Änderung neu geholt, Scroll-Position bleibt
 * erhalten. In einem Hintergrund-Tab ruht die Abfrage und holt beim
 * Zurückkehren sofort nach.
 */
export default function AutoRefresh({ version }: { version: string }) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/stand", { cache: "no-store" });
        if (!res.ok) return;
        const data: { version?: string } = await res.json();
        if (!stopped && data.version && data.version !== version) router.refresh();
      } catch {
        // Kein Netz — beim nächsten Durchgang wieder versuchen.
      }
    }

    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [version, router]);

  return null;
}
