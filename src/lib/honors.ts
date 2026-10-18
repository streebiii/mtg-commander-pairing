import {
  computeTotals,
  countsByGame,
  isParticipation,
  isWinnerAchievement,
  visibleAchievements,
  type SheetAchievement,
} from "./entrySheet";

// Ehrungen für die Rangverkündigung am Saisonende (siehe SPEC.md
// Abschnitt 15): wer am öftesten als erstes eliminiert wurde, wer immer
// mit Sol Ring gespielt hat usw. Reine Logik ohne Datenbankzugriff — alles
// folgt aus den Erfassungen der gezählten Runden.

export interface HonorsPlayer {
  id: string;
  name: string;
}

export interface HonorsEvening {
  round: number;
  lastEvening: boolean;
  achievements: SheetAchievement[];
  players: {
    playerId: string;
    games: number[];
    marks: Map<string, number>;
    hasMarks: boolean;
  }[];
}

export interface HonorEntry {
  playerId: string;
  name: string;
  value: number;
  /** Was neben dem Namen steht, z.B. «5-mal» oder «14 Punkte in R3». */
  label: string;
}

export interface Honor {
  id: string;
  title: string;
  description: string;
  /** Geehrt werden alle mit dem Höchstwert (bei Gleichstand mehrere). */
  winners: HonorEntry[];
  /** Die Nächsten dahinter, höchstens drei — für die Übersicht und das Aufdecken. */
  runnersUp: HonorEntry[];
}

export interface SeasonFact {
  value: number;
  label: string;
}

export interface Honors {
  /** Gezählte Runden (R1–R6), aufsteigend. */
  rounds: number[];
  facts: SeasonFact[];
  honors: Honor[];
}

/** Titel vergleichen, ohne an Gross-/Kleinschreibung oder Apostroph-Varianten zu scheitern. */
const norm = (title: string) => title.toLowerCase().replace(/[’`´]/g, "'").trim();

const FIRST_OUT = norm("I’ve seen this movie");
const HARDCORE = norm("Hardcore Mode");
const ELIMINATE = norm("Eliminate");
const NO_SOL_RING = norm("No Sol Ring");
const ALTERNATIVE = norm("Alternative");

interface PlayerStats {
  games: number;
  /** Wie oft jedes Achievement (nach normalisiertem Titel). */
  counts: Map<string, number>;
  /** Originaltitel zu den normalisierten, für die Anzeige. */
  titles: Map<string, string>;
  wins: number;
  rotating: number;
  deckbauPoints: number;
  best: { total: number; round: number } | null;
  /** Runden mit eigener Erfassung, an denen «No Sol Ring» galt. */
  solRingKnown: number;
  noSolRing: number;
}

const times = (n: number) => `${n}-mal`;

/**
 * Höchstwert-Ehrung: alle mit dem höchsten Wert über 0 gewinnen, die
 * Nächsten (bis zu drei) stehen dahinter. Gleichstand alphabetisch.
 */
function most(
  players: readonly HonorsPlayer[],
  value: (id: string) => number,
  label: (v: number, id: string) => string,
): Pick<Honor, "winners" | "runnersUp"> {
  const entries = players
    .map((p) => ({ playerId: p.id, name: p.name, value: value(p.id) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "de-CH"))
    .map((e) => ({ ...e, label: label(e.value, e.playerId) }));
  const top = entries[0]?.value;
  return {
    winners: entries.filter((e) => e.value === top),
    runnersUp: entries.filter((e) => e.value !== top).slice(0, 3),
  };
}

export function computeHonors(
  players: readonly HonorsPlayer[],
  evenings: readonly HonorsEvening[],
): Honors {
  const stats = new Map<string, PlayerStats>(
    players.map((p) => [
      p.id,
      {
        games: 0,
        counts: new Map(),
        titles: new Map(),
        wins: 0,
        rotating: 0,
        deckbauPoints: 0,
        best: null,
        solRingKnown: 0,
        noSolRing: 0,
      },
    ]),
  );

  // Matches, die jemand höchstens spielen konnte: pro Runde so viele, wie
  // dort jemand gespielt hat (normalerweise 2).
  let possibleGames = 0;

  for (const evening of evenings) {
    possibleGames += Math.max(0, ...evening.players.map((p) => p.games.length));
    const sheet = visibleAchievements(evening.achievements, evening.lastEvening);
    const hasNoSolRing = sheet.some((a) => norm(a.title) === NO_SOL_RING);

    for (const entry of evening.players) {
      const s = stats.get(entry.playerId);
      if (!s) continue; // nicht (mehr) in der Liga
      s.games += entry.games.length;

      let eveningNoSolRing = false;
      for (const a of sheet) {
        const count = countsByGame(a, entry.marks, entry.games).reduce((n, c) => n + c.count, 0);
        if (count === 0) continue;
        if (isWinnerAchievement(a)) s.wins += count;
        if (isParticipation(a)) continue;
        const key = norm(a.title);
        s.counts.set(key, (s.counts.get(key) ?? 0) + count);
        s.titles.set(key, a.title);
        if (a.category === "ROTATING") s.rotating += count;
        if (a.category === "DECKBUILDING") s.deckbauPoints += a.points * count;
        if (key === NO_SOL_RING) eveningNoSolRing = true;
      }

      if (hasNoSolRing && entry.hasMarks) {
        s.solRingKnown += 1;
        if (eveningNoSolRing) s.noSolRing += 1;
      }

      const { total } = computeTotals(
        evening.achievements,
        entry.marks,
        entry.games,
        evening.lastEvening,
      );
      if (!s.best || total > s.best.total) s.best = { total, round: evening.round };
    }
  }

  const of = (id: string) => stats.get(id)!;
  const count = (key: string) => (id: string) => of(id).counts.get(key) ?? 0;
  const byName = (a: HonorsPlayer, b: HonorsPlayer) => a.name.localeCompare(b.name, "de-CH");

  // Achievements, die in der ganzen Saison nur eine Person geschafft hat.
  const reachedBy = new Map<string, string[]>();
  for (const p of players) {
    for (const key of of(p.id).counts.keys()) {
      reachedBy.set(key, [...(reachedBy.get(key) ?? []), p.id]);
    }
  }
  const unique: HonorEntry[] = [...reachedBy]
    .filter(([key, ids]) => ids.length === 1 && key !== NO_SOL_RING)
    .map(([key, [id]]) => ({
      playerId: id,
      name: players.find((p) => p.id === id)!.name,
      value: of(id).counts.get(key)!,
      label: of(id).titles.get(key)!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH") || a.label.localeCompare(b.label));

  const honors: Honor[] = [
    {
      id: "hardcore",
      title: "Hardcore-Mulligan",
      description: "Am öftesten mit 5 oder weniger Karten ins Spiel gestartet",
      ...most(players, count(HARDCORE), times),
    },
    {
      id: "zuerst-raus",
      title: "Schon wieder ich?",
      description: "Am öftesten als erstes eliminiert",
      ...most(players, count(FIRST_OUT), times),
    },
    {
      id: "sol-ring",
      title: "Herr des Rings",
      description: "In jeder Runde mit Sol Ring gespielt",
      winners: players
        .filter((p) => of(p.id).solRingKnown > 0 && of(p.id).noSolRing === 0)
        .sort((a, b) => of(b.id).solRingKnown - of(a.id).solRingKnown || byName(a, b))
        .map((p) => {
          const n = of(p.id).solRingKnown;
          return { playerId: p.id, name: p.name, value: n, label: n === 1 ? "1 Runde" : `${n} Runden` };
        }),
      runnersUp: [],
    },
    {
      id: "gnadenlos",
      title: "Gnadenlos",
      description: "In den meisten Matches jemanden eliminiert",
      ...most(players, count(ELIMINATE), (v) => (v === 1 ? "1 Match" : `${v} Matches`)),
    },
    {
      id: "andere-wege",
      title: "Andere Wege",
      description: "Am öftesten mit einer alternativen Win-Con gewonnen",
      ...most(players, count(ALTERNATIVE), times),
    },
    {
      id: "showtime",
      title: "Showtime",
      description: "Die meisten rotierenden Achievements erfüllt",
      ...most(players, (id) => of(id).rotating, times),
    },
    {
      id: "einzigartig",
      title: "Einzigartig",
      description: "Achievements, die in der ganzen Saison nur eine Person geschafft hat",
      winners: unique,
      runnersUp: [],
    },
    {
      id: "sammelwut",
      title: "Sammelwut",
      description: "Die meisten verschiedenen Achievements erreicht",
      ...most(players, (id) => of(id).counts.size, (v) => `${v} verschiedene`),
    },
    {
      id: "deckbau",
      title: "Deckbau-Kunst",
      description: "Die meisten Punkte aus Deckbau-Achievements",
      ...most(players, (id) => of(id).deckbauPoints, (v) => (v === 1 ? "1 Punkt" : `${v} Punkte`)),
    },
    {
      id: "immer-dabei",
      title: "Immer dabei",
      description: "Jedes Match der Saison gespielt",
      winners:
        possibleGames === 0
          ? []
          : players
              .filter((p) => of(p.id).games >= possibleGames)
              .sort(byName)
              .map((p) => ({
                playerId: p.id,
                name: p.name,
                value: of(p.id).games,
                label: `${of(p.id).games} Matches`,
              })),
      runnersUp: [],
    },
    {
      id: "sternstunde",
      title: "Sternstunde",
      description: "Die meisten Punkte in einer einzigen Runde",
      ...most(
        players,
        (id) => of(id).best?.total ?? 0,
        (v, id) => `${v} Punkte in R${of(id).best!.round}`,
      ),
    },
    {
      id: "chicken-dinner",
      title: "Chicken Dinner",
      description: "Die meisten Matches gewonnen",
      ...most(players, (id) => of(id).wins, (v) => (v === 1 ? "1 Sieg" : `${v} Siege`)),
    },
  ];

  const sum = (f: (s: PlayerStats) => number) =>
    players.reduce((n, p) => n + f(of(p.id)), 0);

  const facts: SeasonFact[] = [
    { value: players.filter((p) => of(p.id).games > 0).length, label: "Spielerinnen und Spieler" },
    { value: sum((s) => s.wins), label: "gewonnene Matches" },
    { value: sum((s) => s.counts.get(ELIMINATE) ?? 0), label: "Matches mit Eliminierung" },
    { value: sum((s) => s.counts.get(HARDCORE) ?? 0), label: "Starts mit 5 oder weniger Karten" },
    { value: sum((s) => s.counts.get(ALTERNATIVE) ?? 0), label: "Siege mit alternativer Win-Con" },
    {
      value: sum((s) => [...s.counts.values()].reduce((n, c) => n + c, 0)),
      label: "erfüllte Achievements",
    },
  ];

  return {
    rounds: evenings.map((e) => e.round).sort((a, b) => a - b),
    facts,
    honors,
  };
}
