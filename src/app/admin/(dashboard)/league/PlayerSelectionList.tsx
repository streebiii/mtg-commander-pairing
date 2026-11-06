"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useState, useTransition } from "react";
import { DangerButton, PrimaryButton, SecondaryButton } from "@/components/Button";
import MobileActionBar from "@/components/MobileActionBar";
import SeasonRoundSelect, { initialSeasonRound } from "@/components/SeasonRoundSelect";
import Sidebar from "@/components/Sidebar";
import {
  PlayerSearchField,
  PlayerTile,
  PlayerTileGrid,
  usePlayerSearch,
} from "@/components/PlayerPicker";
import { discardPreparation, setAttendance, startEvening } from "./actions";

interface PlayerOption {
  id: string;
  name: string;
  points: number;
  /** Anwesend gemeldet — per Scan oder von Hand. */
  present: boolean;
  /** Hat sein Punkteblatt auf einem Handy angemeldet. */
  scanned: boolean;
}

/** Die noch offene Erfassung des letzten Abends, die das Auslosen schliesst. */
export interface OpenEntryInfo {
  eveningId: string;
  /** z.B. «Runde 4 · 13.10.2026». */
  label: string;
  /** Aus dem Datum abgeleitete Spalte, null ausserhalb der Saison. */
  suggestedRound: number | null;
  /** Wie viele noch nicht bestätigt haben. */
  openCount: number;
}

/**
 * Anwesenheit am vorbereiteten Liga-Abend (SPEC.md Abschnitt 5 und 12.1).
 * Wer sein Punkteblatt scannt, erscheint hier von selbst als anwesend (die
 * Seite lädt dann neu); der Organisator korrigiert per Antippen. Die
 * Anwesenheit steht in der Datenbank, nicht im Browser — jedes Gerät des
 * Organisators sieht denselben Stand.
 *
 * «Match 1 auslosen» paart genau die Anwesenden. Ist die Erfassung des
 * letzten Abends noch offen, fragt es zuerst nach, in welcher Spalte sie
 * zählt — das Auslosen schliesst sie (SPEC.md Abschnitt 12.3). Eine
 * Casual-Zuteilung verwirft es ebenfalls; darauf weist ein Satz unter dem
 * Knopf hin.
 */
export default function PlayerSelectionList({
  eveningId,
  players,
  openEntry,
  casualPairing,
  defaultPairByPoints,
  sidebarExtra,
}: {
  eveningId: string;
  players: PlayerOption[];
  openEntry: OpenEntryInfo | null;
  /** Steht gerade eine Casual-Zuteilung, die das Auslosen verwirft? */
  casualPairing: "live" | "warteraum" | null;
  /** Final-Ablauf vorbelegt: am letzten Termin der Saison. */
  defaultPairByPoints: boolean;
  /** Zusätzliches in der Seitenleiste, z.B. der Hinweis auf eine offene Erfassung. */
  sidebarExtra?: ReactNode;
}) {
  // Angetippt, aber vom Server noch nicht bestätigt — so schaltet die
  // Kachel sofort um. Kommt der neue Stand vom Server, gilt wieder er.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [loadedPlayers, setLoadedPlayers] = useState(players);
  if (loadedPlayers !== players) {
    setLoadedPlayers(players);
    setOverrides(new Map());
  }
  const [, startToggle] = useTransition();
  const [state, formAction, pending] = useActionState(startEvening, null);
  // Rückfrage zur offenen Erfassung: in welcher Spalte sie zählt.
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardPending, startDiscard] = useTransition();
  const [seasonRound, setSeasonRound] = useState(
    initialSeasonRound(openEntry?.suggestedRound ?? null),
  );
  const { search, setSearch, filtered, enterTarget } = usePlayerSearch(players);

  const isPresent = (p: PlayerOption) => overrides.get(p.id) ?? p.present;
  const presentCount = players.filter(isPresent).length;
  const canStart = presentCount >= 3;

  function toggle(p: PlayerOption) {
    const next = !isPresent(p);
    setOverrides((prev) => new Map(prev).set(p.id, next));
    startToggle(async () => {
      await setAttendance(eveningId, p.id, next);
    });
  }

  /** Enter: den einzigen Treffer als anwesend markieren (nie abwählen). */
  function handleEnter() {
    if (!enterTarget) return;
    if (!isPresent(enterTarget)) toggle(enterTarget);
    setSearch("");
  }

  // Steht in der Seitenleiste und auf dem Handy zusätzlich in der Leiste
  // unten — beide Stellen teilen sich denselben Zustand.
  const startControls = (
    <div className="flex flex-col gap-2">
      {confirming && openEntry ? (
        <div className="flex flex-col gap-3 rounded border border-white/20 bg-background p-4">
          <p className="text-base">
            Die Achievement-Erfassung von {openEntry.label} ist noch offen
            {openEntry.openCount > 0 && ` — ${openEntry.openCount} haben nicht bestätigt`}.
            Mit dem Auslosen wird sie geschlossen, danach können die Spieler
            nichts mehr ändern.
          </p>
          <SeasonRoundSelect value={seasonRound} onChange={setSeasonRound} disabled={pending} />
          <div className="flex flex-col gap-2">
            <PrimaryButton type="submit" className="w-full" disabled={!canStart} loading={pending}>
              {pending ? "Lose aus…" : "Schliessen und auslosen"}
            </PrimaryButton>
            <SecondaryButton
              className="w-full"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Abbrechen
            </SecondaryButton>
          </div>
        </div>
      ) : openEntry ? (
        <PrimaryButton className="w-full" disabled={!canStart} onClick={() => setConfirming(true)}>
          Match 1 auslosen
        </PrimaryButton>
      ) : (
        <PrimaryButton type="submit" className="w-full" disabled={!canStart} loading={pending}>
          {pending ? "Lose aus…" : "Match 1 auslosen"}
        </PrimaryButton>
      )}
      {!canStart && <p className="text-base opacity-70">Mindestens 3 Anwesende nötig.</p>}
      {casualPairing && (
        <p className="text-base opacity-70">
          {casualPairing === "live"
            ? "Die live geschaltete Casual-Zuteilung wird dabei verworfen."
            : "Die Casual-Zuteilung im Warteraum wird dabei verworfen."}
        </p>
      )}
      {state?.error && <p className="text-base text-red-400">{state.error}</p>}
    </div>
  );

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-4">
      <input type="hidden" name="eveningId" value={eveningId} />
      <section className="flex flex-col gap-3 lg:col-span-3">
        <h2 className="text-lg font-medium">Anwesend ({presentCount})</h2>
        <p className="text-base opacity-70">
          Wer sein Punkteblatt scannt, erscheint hier von selbst. Antippen
          markiert von Hand als anwesend oder nimmt es zurück.
        </p>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            name="pairByPoints"
            defaultChecked={defaultPairByPoints}
            disabled={pending}
            className="h-5 w-5 shrink-0"
          />
          Final-Ablauf: Match 1 nach Rang, Match 2 aus Schnitt und Punkten von Match 1
        </label>
        <PlayerSearchField value={search} onChange={setSearch} onEnter={handleEnter} />
        <PlayerTileGrid totalCount={players.length}>
          {filtered.map((p) => (
            <PlayerTile
              key={p.id}
              name={p.name}
              detail={`· ${p.points} Pkt.`}
              // Das Handy-Zeichen sagt, dass er sein Blatt selbst gescannt
              // hat — ohne steht er von Hand auf der Liste.
              badge={
                p.scanned ? (
                  <span className="shrink-0" role="img" aria-label="gescannt" title="Blatt gescannt">
                    📱
                  </span>
                ) : undefined
              }
              selected={isPresent(p)}
              enterTarget={p.id === enterTarget?.id}
              disabled={pending}
              onClick={() => toggle(p)}
            />
          ))}
        </PlayerTileGrid>
        {openEntry && (
          <>
            <input type="hidden" name="closeEveningId" value={openEntry.eveningId} />
            <input type="hidden" name="closeSeasonRound" value={seasonRound} />
          </>
        )}
      </section>

      <Sidebar>
        <h2 className="text-lg font-medium">Abend</h2>
        {/* Auf dem Handy steht das Auslosen in der Leiste unten. */}
        <div className="hidden lg:block">{startControls}</div>
        <Link
          href="/admin/ligaverwaltung/punkteblaetter"
          className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 px-4 py-2 text-base font-medium hover:bg-white/5"
        >
          Punkteblätter drucken
        </Link>
        {discarding ? (
          <div className="flex flex-col gap-2 rounded border border-white/20 p-3">
            <p className="text-base">
              Vorbereitung verwerfen? Die gedruckten Punkteblätter werden damit ungültig.
            </p>
            <DangerButton
              className="w-full"
              loading={discardPending}
              onClick={() => startDiscard(() => discardPreparation(eveningId))}
            >
              Verwerfen
            </DangerButton>
            <SecondaryButton className="w-full" onClick={() => setDiscarding(false)}>
              Abbrechen
            </SecondaryButton>
          </div>
        ) : (
          <SecondaryButton className="w-full" onClick={() => setDiscarding(true)} disabled={pending}>
            Vorbereitung verwerfen
          </SecondaryButton>
        )}
        {sidebarExtra}
      </Sidebar>

      <MobileActionBar>
        <p className="text-base opacity-70">{presentCount} anwesend</p>
        {startControls}
      </MobileActionBar>
    </form>
  );
}
