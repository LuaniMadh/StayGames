import { GameDefinition } from '../types.js';
import {
  computeQuickStandings,
  createEmptyQuickState,
  isQuickState,
  rankEntries,
} from './helpers.js';

export interface WizardConfig {
  maxRounds: number;
  forbidExactTotalBid: boolean;
}

export interface WizardPlayerRound {
  playerId: number;
  bid: number;
  tricks: number;
  delta: number;
  cumulativeScore: number;
}

export interface WizardRound {
  roundNumber: number;
  cardsDealt: number;
  dealerPlayerId: number;
  entries: WizardPlayerRound[];
}

export interface WizardState {
  kind: 'wizard';
  currentRound: number;
  maxRounds: number;
  /** Bids for the round in progress (defaults or locked values). */
  pendingBids: Record<number, number>;
  /** True once the bids for the current round were locked (trick entry phase). */
  bidsLocked?: boolean;
  rounds: WizardRound[];
}

export interface WizardRoundInput {
  type?: 'complete_round' | 'save_bids';
  bids: Record<number, number>;
  tricks?: Record<number, number>;
}

export function calculateWizardDelta(bid: number, tricks: number): number {
  if (bid === tricks) {
    return 20 + 10 * tricks;
  }
  return -10 * Math.abs(bid - tricks);
}

/** Suggested starting bid: cards dealt ÷ players, rounded. */
export function defaultWizardBids(
  playerIds: number[],
  cardsDealt: number
): Record<number, number> {
  const suggestion = playerIds.length > 0 ? Math.round(cardsDealt / playerIds.length) : 0;
  return Object.fromEntries(playerIds.map((pid) => [pid, suggestion]));
}

function validateWizardBids(
  bids: Record<number, number> | undefined,
  playerIds: number[],
  cardsDealt: number,
  config: WizardConfig
): void {
  let totalBids = 0;
  for (const pid of playerIds) {
    const bid = Number(bids?.[pid]);
    if (!Number.isInteger(bid) || bid < 0 || bid > cardsDealt) {
      throw new Error(`Bid for each player must be between 0 and ${cardsDealt}.`);
    }
    totalBids += bid;
  }
  if (config.forbidExactTotalBid && totalBids === cardsDealt) {
    throw new Error(
      `Plus/Minus rule active: total bids (${totalBids}) cannot equal cards dealt (${cardsDealt}).`
    );
  }
}

function validateWizardTricks(
  tricks: Record<number, number> | undefined,
  playerIds: number[],
  cardsDealt: number
): void {
  if (!tricks) {
    throw new Error('Tricks won must be provided for all players to complete the round.');
  }
  let totalTricks = 0;
  for (const pid of playerIds) {
    const t = Number(tricks[pid]);
    if (!Number.isInteger(t) || t < 0 || t > cardsDealt) {
      throw new Error(`Tricks won must be between 0 and ${cardsDealt}.`);
    }
    totalTricks += t;
  }
  if (totalTricks !== cardsDealt) {
    throw new Error(`Total tricks won (${totalTricks}) must equal cards dealt (${cardsDealt}).`);
  }
}

/**
 * Rebuilds all round entries (deltas + cumulative scores) in order.
 * `overrides` replaces bids/tricks of specific rounds (by round number).
 */
function recomputeWizardRounds(
  rounds: WizardRound[],
  playerIds: number[],
  overrides: Record<number, { bids: Record<number, number>; tricks: Record<number, number> }>
): WizardRound[] {
  const totals = new Map<number, number>(playerIds.map((pid) => [pid, 0]));
  return rounds.map((round) => {
    const override = overrides[round.roundNumber];
    const entries = playerIds.map((pid) => {
      const existing = round.entries.find((e) => e.playerId === pid);
      const bid = Number(override ? override.bids[pid] : existing?.bid ?? 0);
      const tricks = Number(override ? override.tricks[pid] : existing?.tricks ?? 0);
      const delta = calculateWizardDelta(bid, tricks);
      const cumulativeScore = (totals.get(pid) ?? 0) + delta;
      totals.set(pid, cumulativeScore);
      return { playerId: pid, bid, tricks, delta, cumulativeScore };
    });
    return { ...round, entries };
  });
}

export const wizardGame: GameDefinition<
  WizardConfig,
  WizardState,
  WizardRoundInput
> = {
  slug: 'wizard',
  name: 'Wizard',
  tagline: 'Magical trick-taking of exact predictions',
  description:
    'Predict the exact number of tricks you will win each round. Hit your bid for +20 plus 10 per trick, or lose 10 points for every trick off!',
  rulesSummary: [
    'Round 1 deals 1 card per player, adding 1 card each round up to 60 ÷ players.',
    'Exact bid scores +20 points plus +10 per trick won.',
    'Missing your bid costs -10 points per trick over or under.',
    'Optional Plus/Minus rule: the dealer may not make total bids equal cards dealt.',
  ],
  minPlayers: 3,
  maxPlayers: 6,
  supportedModes: ['scorecard', 'quick'],
  defaultMode: 'scorecard',
  scoringDirection: 'highest_wins',
  themeColor: 'indigo',
  iconName: 'wand',
  configFields: [
    {
      key: 'maxRounds',
      label: 'Total Rounds',
      description: 'Standard is 60 ÷ players (20 for 3p, 15 for 4p, 12 for 5p, 10 for 6p)',
      type: 'number',
      min: 1,
      max: 20,
      step: 1,
    },
    {
      key: 'forbidExactTotalBid',
      label: 'Forbidden Exact Total Bid (±1 Rule)',
      description: 'Total bids in a round cannot equal the number of cards dealt',
      type: 'boolean',
    },
  ],
  leaderboardColumns: [
    {
      key: 'bidAccuracy',
      label: 'Bid Accuracy',
      tooltip: 'Percentage of rounds where exact bid was achieved',
      align: 'right',
      format: 'percent',
      aggregate: 'ratio_percent',
      statKey: 'exactBids',
      denominatorStatKey: 'roundsPlayed',
    },
    {
      key: 'zeroBidsHit',
      label: '0-Bids Hit',
      tooltip: 'Successful zero-trick predictions',
      align: 'right',
      format: 'integer',
      aggregate: 'sum',
      statKey: 'zeroBidsHit',
    },
  ],

  getDefaultConfig(playerCount: number): WizardConfig {
    const safeCount = Math.min(6, Math.max(3, playerCount || 4));
    return {
      maxRounds: Math.floor(60 / safeCount),
      forbidExactTotalBid: false,
    };
  },

  createInitialState(playerIds, config, mode) {
    if (mode === 'quick') {
      return createEmptyQuickState(playerIds);
    }
    return {
      kind: 'wizard',
      currentRound: 1,
      maxRounds: config.maxRounds,
      pendingBids: defaultWizardBids(playerIds, 1),
      bidsLocked: false,
      rounds: [],
    };
  },

  addRound(state, roundInput, playerIds, config) {
    if (state.rounds.length >= config.maxRounds) {
      throw new Error('All rounds have already been completed for this Wizard match.');
    }

    const roundNumber = state.rounds.length + 1;
    const cardsDealt = roundNumber;

    validateWizardBids(roundInput.bids, playerIds, cardsDealt, config);

    // Allow locking bids mid-round before tricks are played
    if (roundInput.type === 'save_bids') {
      return {
        ...state,
        pendingBids: { ...roundInput.bids },
        bidsLocked: true,
      };
    }

    validateWizardTricks(roundInput.tricks, playerIds, cardsDealt);

    const newRound: WizardRound = {
      roundNumber,
      cardsDealt,
      dealerPlayerId: playerIds[(roundNumber - 1) % playerIds.length],
      entries: [],
    };
    const nextRounds = recomputeWizardRounds(
      [...state.rounds, newRound],
      playerIds,
      { [roundNumber]: { bids: roundInput.bids, tricks: roundInput.tricks! } }
    );

    return {
      ...state,
      maxRounds: config.maxRounds,
      currentRound: Math.min(config.maxRounds, nextRounds.length + 1),
      pendingBids: defaultWizardBids(playerIds, nextRounds.length + 1),
      bidsLocked: false,
      rounds: nextRounds,
    };
  },

  editRound(state, roundNumber, roundInput, playerIds, config) {
    const target = state.rounds.find((r) => r.roundNumber === roundNumber);
    if (!target) {
      throw new Error(`Round ${roundNumber} has not been played yet.`);
    }
    validateWizardBids(roundInput.bids, playerIds, target.cardsDealt, config);
    validateWizardTricks(roundInput.tricks, playerIds, target.cardsDealt);

    return {
      ...state,
      rounds: recomputeWizardRounds(state.rounds, playerIds, {
        [roundNumber]: { bids: roundInput.bids, tricks: roundInput.tricks! },
      }),
    };
  },

  undoLastRound(state, playerIds, config) {
    if (state.rounds.length === 0) {
      return state;
    }
    const popped = state.rounds[state.rounds.length - 1];
    const nextRounds = state.rounds.slice(0, -1);
    const restoredPending: Record<number, number> = {};
    for (const pid of playerIds) {
      const prev = popped.entries.find((e) => e.playerId === pid);
      restoredPending[pid] = prev?.bid ?? 0;
    }
    // The undone round's bids were already locked — jump back to trick entry
    return {
      ...state,
      maxRounds: config.maxRounds,
      currentRound: nextRounds.length + 1,
      pendingBids: restoredPending,
      bidsLocked: true,
      rounds: nextRounds,
    };
  },

  isGameComplete(state, _playerIds, config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return true;
    }
    return state.rounds.length >= config.maxRounds;
  },

  computeStandings(state, playerIds, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return computeQuickStandings(state as any, playerIds, 'pts');
    }

    const lastRound = state.rounds[state.rounds.length - 1];
    const items = playerIds.map((pid) => {
      const score =
        lastRound?.entries.find((e) => e.playerId === pid)?.cumulativeScore ?? 0;
      let exactBids = 0;
      for (const r of state.rounds) {
        const entry = r.entries.find((e) => e.playerId === pid);
        if (entry && entry.bid === entry.tricks) {
          exactBids += 1;
        }
      }
      return {
        playerId: pid,
        score,
        exactBids,
        roundsPlayed: state.rounds.length,
      };
    });

    return rankEntries(
      items,
      (a, b) => b.score - a.score || b.exactBids - a.exactBids,
      (item, rank, isWinner) => ({
        playerId: item.playerId,
        rank,
        isWinner,
        score: item.score,
        scoreFormatted: `${item.score} pts`,
        secondaryBadge:
          item.roundsPlayed > 0
            ? `${item.exactBids}/${item.roundsPlayed} exact`
            : '0 rounds',
      })
    );
  },

  extractPlayerStats(state, playerId, standing, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return {
        exactBids: 0,
        roundsPlayed: 0,
        zeroBidsHit: 0,
        finalScore: standing.score,
      };
    }

    let exactBids = 0;
    let zeroBidsHit = 0;
    let bestRoundDelta = 0;

    for (const round of state.rounds) {
      const entry = round.entries.find((e) => e.playerId === playerId);
      if (!entry) continue;
      if (entry.bid === entry.tricks) {
        exactBids += 1;
        if (entry.bid === 0) {
          zeroBidsHit += 1;
        }
      }
      if (entry.delta > bestRoundDelta) {
        bestRoundDelta = entry.delta;
      }
    }

    return {
      exactBids,
      roundsPlayed: state.rounds.length,
      zeroBidsHit,
      bestRoundDelta,
      finalScore: standing.score,
    };
  },
};
