"use client";

import { type ReactNode, useActionState, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/Button";
import MobileActionBar from "@/components/MobileActionBar";
import SeasonRoundSelect, { initialSeasonRound } from "@/components/SeasonRoundSelect";
import Sidebar from "@/components/Sidebar";
import {
  PlayerSearchField,
  PlayerTile,
  PlayerTileGrid,
  usePlayerSearch,
} from "@/components/PlayerPicker";
import { startEvening } from "./actions";

interface PlayerOption {
  id: string;
  name: string;
  points: number;
}

/** Die noch offene Erfassung des letzten Abends, die der Start schliesst. */
export interface OpenEntryInfo {
  eveningId: string;
  /** z.B. «Runde 4 · 13.10.2026». */
  label: string;
  /** Aus dem Datum abgeleitete Spalte, null ausserhalb der Saison. */
  suggestedRound: number | null;
  /** Wie viele noch nicht abgegeben haben. */
  openCount: number;
}

/**
 * Anwesenheits-Auswahl beim Start eines Liga-Abends — dieselbe Liste wie
 * im Casual-Tab (Suche, Enter wählt den einzigen Treffer), plus ein
 * Umschalter für alle: bei fast vollständiger Anwesenheit wählt der
 * Organisator dann nur noch die paar fehlenden ab. Neue Spieler werden
 * hier bewusst nicht angelegt — Liga-Teilnehmende kommen über den
 * Spieler-Tab. Aufgebaut wie der Casual-Tab: links die Auswahl, rechts die
 * Seitenleiste mit «Runde starten», auf dem Handy zusätzlich unten fest.
 *
 * Ist die Erfassung des letzten Abends noch offen, fragt «Runde starten»
 * zuerst nach, in welcher Spalte sie zählt — der Start schliesst sie
 * (SPEC.md Abschnitt 12.3). Eine Casual-Zuteilung verwirft der Start
 * ebenfalls; darauf weist ein Satz unter dem Knopf hin.
 *
 * Die Auswahl geht als versteckte `playerIds`-Felder mit — unabhängig
 * davon, ob ein Spieler gerade von der Suche ausgefiltert ist.
 */
export default function PlayerSelectionList({
  players,
  openEntry,
  casualPairing,
  sidebarExtra,
}: {
  players: PlayerOption[];
  openEntry: OpenEntryInfo | null;
  /** Steht gerade eine Casual-Zuteilung, die der Start verwirft? */
  casualPairing: "live" | "warteraum" | null;
  /** Zusätzliches in der Seitenleiste, z.B. der Hinweis auf eine offene Erfassung. */
  sidebarExtra?: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState(startEvening, null);
  // Rückfrage zur offenen Erfassung: in welcher Spalte sie zählt.
  const [confirming, setConfirming] = useState(false);
  const [seasonRound, setSeasonRound] = useState(
    initialSeasonRound(openEntry?.suggestedRound ?? null),
  );
  const { search, setSearch, filtered, enterTarget } = usePlayerSearch(players);

  const allSelected = players.length > 0 && selected.size === players.length;
  const canStart = selected.size >= 3;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(players.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Enter: den einzigen Treffer auswählen (nie abwählen) und weitertippen. */
  function handleEnter() {
    if (!enterTarget) return;
    setSelected((prev) => new Set(prev).add(enterTarget.id));
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
            {openEntry.openCount > 0 && ` — ${openEntry.openCount} haben nicht abgegeben`}.
            Mit dem Start wird sie geschlossen, danach können die Spieler
            nichts mehr ändern.
          </p>
          <SeasonRoundSelect value={seasonRound} onChange={setSeasonRound} disabled={pending} />
          <div className="flex flex-col gap-2">
            <PrimaryButton type="submit" className="w-full" disabled={!canStart} loading={pending}>
              {pending ? "Starte…" : "Schliessen und starten"}
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
          Runde starten
        </PrimaryButton>
      ) : (
        <PrimaryButton type="submit" className="w-full" disabled={!canStart} loading={pending}>
          {pending ? "Starte…" : "Runde starten"}
        </PrimaryButton>
      )}
      {selected.size > 0 && !canStart && (
        <p className="text-base opacity-70">Mindestens 3 Spieler nötig.</p>
      )}
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
      <section className="flex flex-col gap-3 lg:col-span-3">
        <h2 className="text-lg font-medium">
          Anwesende Spieler auswählen ({selected.size})
        </h2>
        <PlayerSearchField value={search} onChange={setSearch} onEnter={handleEnter} />
        <PlayerTileGrid totalCount={players.length}>
          {filtered.map((p) => (
            <PlayerTile
              key={p.id}
              name={p.name}
              detail={`(${p.points})`}
              selected={selected.has(p.id)}
              enterTarget={p.id === enterTarget?.id}
              disabled={pending}
              onClick={() => toggle(p.id)}
            />
          ))}
        </PlayerTileGrid>
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="playerIds" value={id} />
        ))}
        {openEntry && (
          <>
            <input type="hidden" name="closeEveningId" value={openEntry.eveningId} />
            <input type="hidden" name="closeSeasonRound" value={seasonRound} />
          </>
        )}
      </section>

      <Sidebar>
        <h2 className="text-lg font-medium">Runde</h2>
        <SecondaryButton onClick={toggleAll} className="w-full" disabled={pending}>
          {allSelected ? "Auswahl aufheben" : "Alle auswählen"}
        </SecondaryButton>
        {/* Auf dem Handy steht der Start in der Leiste unten. */}
        <div className="hidden lg:block">{startControls}</div>
        {sidebarExtra}
      </Sidebar>

      <MobileActionBar>
        <p className="text-base opacity-70">{selected.size} ausgewählt</p>
        {startControls}
      </MobileActionBar>
    </form>
  );
}
