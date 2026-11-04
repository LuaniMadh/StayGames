import { QuickModeState, StandingEntry } from '../types.js';

export function isQuickState(state: unknown): state is QuickModeState {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as QuickModeState).kind === 'quick'
  );
}

export function createEmptyQuickState(playerIds: number[]): QuickModeState {
  return {
    kind: 'quick',
    placements: playerIds.map((playerId, index) => ({
      playerId,
      placement: index + 1,
      score: null,
    })),
  };
}

export function computeQuickStandings(
  state: QuickModeState,
  playerIds: number[],
  unitLabel = 'pts'
): StandingEntry[] {
  const byPlayer = new Map(state.placements.map((p) => [p.playerId, p]));
  const items = playerIds.map((playerId, idx) => {
    const entry = byPlayer.get(playerId);
    return {
      playerId,
      placement: entry?.placement ?? idx + 1,
      score: entry?.score ?? 0,
      hasScore: entry?.score !== null && entry?.score !== undefined,
    };
  });

  items.sort((a, b) => a.placement - b.placement);
  const bestPlacement = items.length > 0 ? items[0].placement : 1;

  return items.map((item) => ({
    playerId: item.playerId,
    rank: item.placement,
    isWinner: item.placement === bestPlacement,
    score: item.score,
    scoreFormatted: item.hasScore
      ? `${item.score} ${unitLabel}`
      : `#${item.placement}`,
    secondaryBadge: `Place #${item.placement}`,
  }));
}

export interface CooperativeStandingsOptions {
  isWin?: boolean;
  rank?: number;
  secondaryBadge?: string;
  scoreFormatted?: string;
  unitLabel?: string;
}

/**
 * Creates cooperative standings where all players share the same team outcome.
 * Every participant receives rank 1 (or the specified rank) and shares the team win/loss status.
 */
export function createCooperativeStandings(
  playerIds: number[],
  teamScore: number,
  options: CooperativeStandingsOptions = {}
): StandingEntry[] {
  const isWin = options.isWin ?? true;
  const rank = options.rank ?? 1;
  const unit = options.unitLabel ?? 'pts';
  const scoreFormatted = options.scoreFormatted ?? `${teamScore} ${unit}`;
  const secondaryBadge =
    options.secondaryBadge ?? (isWin ? 'Team Victory' : 'Team Defeat');

  return playerIds.map((playerId) => ({
    playerId,
    rank,
    isWinner: isWin,
    score: teamScore,
    scoreFormatted,
    secondaryBadge,
  }));
}

export interface RankOptions<T> {
  scoringDirection?: 'highest_wins' | 'lowest_wins';
  cooperative?: boolean;
  unitLabel?: string;
  compare?: (a: T, b: T) => number;
  isWinner?: (item: T, rank: number) => boolean;
  formatScore?: (score: number) => string;
}

/**
 * Ranks items with standard competition ranking (1, 1, 3, 4).
 * Supports both comparator+transform callback signature and declarative options signature.
 */
export function rankEntries<T extends { playerId: number; score?: number }>(
  items: T[],
  compareOrOptions?: ((a: T, b: T) => number) | RankOptions<T>,
  toStandingFn?: (item: T, rank: number, isWinner: boolean) => StandingEntry
): StandingEntry[] {
  // Signature 1: rankEntries(items, compareFn, toStandingFn)
  if (typeof compareOrOptions === 'function' && typeof toStandingFn === 'function') {
    const compare = compareOrOptions;
    const sorted = [...items].sort(compare);
    const results: StandingEntry[] = [];
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && compare(sorted[i - 1], sorted[i]) !== 0) {
        currentRank = i + 1;
      }
      results.push(toStandingFn(sorted[i], currentRank, currentRank === 1));
    }
    return results;
  }

  // Signature 2: rankEntries(items, options)
  const opts = (typeof compareOrOptions === 'object' && compareOrOptions !== null)
    ? compareOrOptions
    : {};

  if (opts.cooperative) {
    const teamScore = items.length > 0 ? (items[0].score ?? 0) : 0;
    return createCooperativeStandings(
      items.map((it) => it.playerId),
      teamScore,
      { unitLabel: opts.unitLabel }
    );
  }

  const highest = opts.scoringDirection !== 'lowest_wins';
  const compare = opts.compare ?? ((a: T, b: T) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return highest ? sb - sa : sa - sb;
  });

  const sorted = [...items].sort(compare);
  const results: StandingEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && compare(sorted[i - 1], sorted[i]) !== 0) {
      currentRank = i + 1;
    }
    const item = sorted[i];
    const score = item.score ?? 0;
    const isWinner = opts.isWinner ? opts.isWinner(item, currentRank) : currentRank === 1;
    const formatted = opts.formatScore
      ? opts.formatScore(score)
      : `${score} ${opts.unitLabel ?? 'pts'}`;

    results.push({
      playerId: item.playerId,
      rank: currentRank,
      isWinner,
      score,
      scoreFormatted: formatted,
    });
  }

  return results;
}
