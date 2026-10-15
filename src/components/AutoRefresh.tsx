"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Wie oft die offene Seite nachfragt, ob sich etwas geändert hat. */
const CHECK_INTERVAL_MS = 10_000;

/**
 * Lädt eine Seite neu, sobald sich an ihrem Inhalt etwas ändert — sonst
 * nie. Die öffentliche Pairing-Seite zeigt damit ohne Zutun das aktuelle
 * Match, der Liga-Tab einen Sieger, den ein Spieler selbst eingetragen
 * hat, und das Erfassungsblatt den Sieger, den der Organisator gesetzt hat.
 *
 * Gefragt wird nur nach einem kurzen Fingerabdruck (`src`, Standard
 * `/stand`); die Seite selbst wird nur bei einer Änderung neu geholt,
 * Scroll-Position und Eingaben bleiben erhalten. In einem Hintergrund-Tab
 * ruht die Abfrage und holt beim Zurückkehren sofort nach.
 */
export default function AutoRefresh({
  version,
  src = "/stand",
}: {
  version: string;
  src?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(src, { cache: "no-store" });
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
  }, [version, src, router]);

  return null;
}
