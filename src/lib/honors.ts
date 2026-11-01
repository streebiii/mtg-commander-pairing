import { COLOR_NAMES, COLORS, colorsOf } from "./colorIdentity";
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
// folgt aus den Erfassungen der gezählten Runden. Weil jede Markierung
// ihr Match kennt, lassen sich auch Kombinationen auswerten («mit 5
// Karten gestartet und trotzdem gewonnen»).

export interface HonorsPlayer {
  id: string;
  name: string;
  /** Ausgeloste Farbidentität («WR»), für die Farbe mit den meisten Siegen. */
  colorIdentity?: string | null;
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
  /** Spieler-ID, bei der Farbe «farbe-G». Nur als Schlüssel gedacht. */
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
}

/** Ehrungen eines Themas. */
export interface HonorGroup {
  title: string;
  honors: Honor[];
}

export interface Honors {
  /** Gezählte Runden (R1–R6), aufsteigend. */
  rounds: number[];
  groups: HonorGroup[];
}

/** Themen und Reihenfolge der Ehrungen. */
const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Mulligans", ids: ["mulligan", "mulligan-sieg", "mulligan-raus"] },
  {
    title: "Eliminierungen",
    ids: ["zuerst-raus", "eliminierungen", "eliminiert-ohne-sieg", "neutral"],
  },
  { title: "Decks", ids: ["sol-ring", "deckbau", "alternativ"] },
  { title: "Achievements", ids: ["rotierend", "verschiedene", "einzigartig"] },
  { title: "Runden", ids: ["immer-dabei", "schwankung", "beste-runde"] },
  { title: "Siege", ids: ["beide-gewonnen", "farbe", "siege"] },
];

/** Titel vergleichen, ohne an Gross-/Kleinschreibung oder Apostroph-Varianten zu scheitern. */
const norm = (title: string) => title.toLowerCase().replace(/[’`´]/g, "'").trim();

const FIRST_OUT = norm("I’ve seen this movie");
const HARDCORE = norm("Hardcore Mode");
const ELIMINATE = norm("Eliminate");
const NO_SOL_RING = norm("No Sol Ring");
const ALTERNATIVE = norm("Alternative");
/** Schlüssel für «Winner winner» — der Titel kann variieren, der systemKey nicht. */
const WIN = "\0winner";

interface PlayerStats {
  games: number;
  /** Wie oft jedes Achievement (nach normalisiertem Titel). */
  counts: Map<string, number>;
  /** Originaltitel zu den normalisierten, für die Anzeige. */
  titles: Map<string, string>;
  wins: number;
  rotating: number;
  deckbauPoints: number;
  /** Totals je gespielter Runde. */
  totals: { total: number; round: number }[];
  /** Runden mit eigener Erfassung, an denen «No Sol Ring» galt. */
  solRingKnown: number;
  noSolRing: number;
  /** Kombinationen im selben Match. */
  mulliganWin: number;
  mulliganFirstOut: number;
  eliminatedNoWin: number;
  /** Matches ohne Sieg, ohne Eliminierung und nicht als erstes raus. */
  neutral: number;
  /** Runden, in denen Match 1 und Match 2 gewonnen wurden. */
  bothWon: number;
}

const times = (n: number) => `${n}-mal`;
const matches = (n: number) => (n === 1 ? "1 Match" : `${n} Matches`);

/** Höchstwert-Ehrung: alle mit dem höchsten Wert über 0 gewinnen, alphabetisch. */
function most(
  candidates: readonly { id: string; name: string }[],
  value: (id: string) => number,
  label: (v: number, id: string) => string,
): Pick<Honor, "winners"> {
  const entries = candidates
    .map((p) => ({ playerId: p.id, name: p.name, value: value(p.id) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "de-CH"))
    .map((e) => ({ ...e, label: label(e.value, e.playerId) }));
  const top = entries[0]?.value;
  return { winners: entries.filter((e) => e.value === top) };
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
        totals: [],
        solRingKnown: 0,
        noSolRing: 0,
        mulliganWin: 0,
        mulliganFirstOut: 0,
        eliminatedNoWin: 0,
        neutral: 0,
        bothWon: 0,
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

      // Was in welchem Match erreicht wurde (Spiel 0 = ganze Runde).
      const byGame = new Map<number, Set<string>>(entry.games.map((g) => [g, new Set()]));
      let eveningNoSolRing = false;
      for (const a of sheet) {
        if (isParticipation(a)) continue;
        const key = isWinnerAchievement(a) ? WIN : norm(a.title);
        for (const { game, count } of countsByGame(a, entry.marks, entry.games)) {
          if (count === 0) continue;
          byGame.get(game)?.add(key);
          if (key === WIN) {
            s.wins += count;
            continue;
          }
          s.counts.set(key, (s.counts.get(key) ?? 0) + count);
          s.titles.set(key, a.title);
          if (a.category === "ROTATING") s.rotating += count;
          if (a.category === "DECKBUILDING") s.deckbauPoints += a.points * count;
          if (key === NO_SOL_RING) eveningNoSolRing = true;
        }
      }

      for (const game of entry.games) {
        const got = byGame.get(game)!;
        if (got.has(HARDCORE) && got.has(WIN)) s.mulliganWin += 1;
        if (got.has(HARDCORE) && got.has(FIRST_OUT)) s.mulliganFirstOut += 1;
        if (got.has(ELIMINATE) && !got.has(WIN)) s.eliminatedNoWin += 1;
        // Ohne eigene Erfassung sähe jedes Match neutral aus.
        if (entry.hasMarks && !got.has(WIN) && !got.has(ELIMINATE) && !got.has(FIRST_OUT)) {
          s.neutral += 1;
        }
      }
      if (byGame.get(1)?.has(WIN) && byGame.get(2)?.has(WIN)) s.bothWon += 1;

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
      s.totals.push({ total, round: evening.round });
    }
  }

  const of = (id: string) => stats.get(id)!;
  const count = (key: string) => (id: string) => of(id).counts.get(key) ?? 0;
  const byName = (a: HonorsPlayer, b: HonorsPlayer) => a.name.localeCompare(b.name, "de-CH");
  const best = (id: string) =>
    of(id).totals.reduce<{ total: number; round: number } | null>(
      (b, t) => (!b || t.total > b.total ? t : b),
      null,
    );

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

  // Schwankung erst ab drei Runden — mit zweien ist sie Zufall.
  const swing = (id: string) => {
    const t = of(id).totals.map((x) => x.total);
    return t.length >= 3 ? Math.max(...t) - Math.min(...t) : 0;
  };

  // Siege pro Match je Farbe, über alle mit dieser Farbe in der Identität.
  const byColor = COLORS.map((c) => {
    const holders = players.filter((p) => colorsOf(p.colorIdentity).includes(c));
    return {
      id: `farbe-${c}`,
      name: COLOR_NAMES[c],
      wins: holders.reduce((n, p) => n + of(p.id).wins, 0),
      games: holders.reduce((n, p) => n + of(p.id).games, 0),
    };
  }).filter((c) => c.games > 0);
  const colorById = new Map(byColor.map((c) => [c.id, c]));

  const honors: Honor[] = [
    {
      id: "mulligan",
      title: "Mulligan auf 5",
      description: "Am öftesten mit 5 oder weniger Karten ins Spiel gestartet",
      ...most(players, count(HARDCORE), times),
    },
    {
      id: "mulligan-sieg",
      title: "Sieg nach Mulligan",
      description: "Mit 5 oder weniger Karten gestartet und trotzdem gewonnen",
      ...most(players, (id) => of(id).mulliganWin, times),
    },
    {
      id: "mulligan-raus",
      title: "Mulligan und als erstes raus",
      description: "Mit 5 oder weniger Karten gestartet und als erstes eliminiert",
      ...most(players, (id) => of(id).mulliganFirstOut, times),
    },
    {
      id: "zuerst-raus",
      title: "Als erstes eliminiert",
      description: "Am öftesten als erstes aus dem Match ausgeschieden",
      ...most(players, count(FIRST_OUT), times),
    },
    {
      id: "sol-ring",
      title: "Immer mit Sol Ring",
      description: "In jeder Runde mit Sol Ring im Deck gespielt",
      winners: players
        .filter((p) => of(p.id).solRingKnown > 0 && of(p.id).noSolRing === 0)
        .sort((a, b) => of(b.id).solRingKnown - of(a.id).solRingKnown || byName(a, b))
        .map((p) => {
          const n = of(p.id).solRingKnown;
          return { playerId: p.id, name: p.name, value: n, label: n === 1 ? "1 Runde" : `${n} Runden` };
        }),
    },
    {
      id: "eliminiert-ohne-sieg",
      title: "Eliminiert, aber nicht gewonnen",
      description: "Am öftesten jemanden eliminiert, das Match aber nicht gewonnen",
      ...most(players, (id) => of(id).eliminatedNoWin, times),
    },
    {
      id: "neutral",
      title: "Neutrale Matches",
      description: "Die meisten Matches ohne Sieg, ohne Eliminierung und nicht als erstes raus",
      ...most(players, (id) => of(id).neutral, matches),
    },
    {
      id: "eliminierungen",
      title: "Die meisten Eliminierungen",
      description: "In den meisten Matches jemanden eliminiert",
      ...most(players, count(ELIMINATE), matches),
    },
    {
      id: "alternativ",
      title: "Alternative Win-Con",
      description: "Am öftesten mit einer alternativen Win-Con gewonnen",
      ...most(players, count(ALTERNATIVE), times),
    },
    {
      id: "rotierend",
      title: "Rotierende Achievements",
      description: "Die meisten rotierenden Achievements erfüllt",
      ...most(players, (id) => of(id).rotating, times),
    },
    {
      id: "einzigartig",
      title: "Nur einmal geschafft",
      description: "Achievements, die in der ganzen Saison nur eine Person erreicht hat",
      winners: unique,
    },
    {
      id: "verschiedene",
      title: "Verschiedene Achievements",
      description: "Die meisten verschiedenen Achievements erreicht",
      ...most(players, (id) => of(id).counts.size, (v) => `${v} verschiedene`),
    },
    {
      id: "deckbau",
      title: "Deckbau-Punkte",
      description: "Die meisten Punkte aus Deckbau-Achievements",
      ...most(players, (id) => of(id).deckbauPoints, (v) => (v === 1 ? "1 Punkt" : `${v} Punkte`)),
    },
    {
      id: "immer-dabei",
      title: "Jedes Match gespielt",
      description: "In der ganzen Saison kein Match verpasst",
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
                label: matches(of(p.id).games),
              })),
    },
    {
      id: "schwankung",
      title: "Grösste Schwankung",
      description: "Grösster Abstand zwischen der besten und der schwächsten Runde",
      ...most(players, swing, (_, id) => {
        const t = of(id).totals.map((x) => x.total);
        return `${Math.min(...t)} bis ${Math.max(...t)} Punkte`;
      }),
    },
    {
      id: "beste-runde",
      title: "Beste Runde",
      description: "Die meisten Punkte in einer einzigen Runde",
      ...most(
        players,
        (id) => best(id)?.total ?? 0,
        (v, id) => `${v} Punkte in R${best(id)!.round}`,
      ),
    },
    {
      id: "beide-gewonnen",
      title: "Beide Matches gewonnen",
      description: "Am öftesten an einem Abend Match 1 und Match 2 gewonnen",
      ...most(players, (id) => of(id).bothWon, times),
    },
    {
      id: "farbe",
      title: "Farbe mit den meisten Siegen",
      description: "Siege pro Match nach ausgeloster Farbidentität",
      ...most(
        byColor,
        // In Promille, damit «most» mit ganzen Zahlen vergleicht.
        (id) => Math.round((colorById.get(id)!.wins / colorById.get(id)!.games) * 1000),
        (_, id) => {
          const c = colorById.get(id)!;
          return `${Math.round((c.wins / c.games) * 100)} % (${c.wins} von ${c.games})`;
        },
      ),
    },
    {
      id: "siege",
      title: "Die meisten Siege",
      description: "Die meisten Matches gewonnen",
      ...most(players, (id) => of(id).wins, (v) => (v === 1 ? "1 Sieg" : `${v} Siege`)),
    },
  ];

  const byId = new Map(honors.map((h) => [h.id, h]));
  return {
    rounds: evenings.map((e) => e.round).sort((a, b) => a - b),
    groups: GROUPS.map((g) => ({ title: g.title, honors: g.ids.map((id) => byId.get(id)!) })),
  };
}
