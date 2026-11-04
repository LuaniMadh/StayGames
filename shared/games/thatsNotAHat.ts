import { GameDefinition } from '../types.js';
import {
  computeQuickStandings,
  createEmptyQuickState,
  isQuickState,
  rankEntries,
} from './helpers.js';

export interface ThatsNotAHatConfig {
  penaltyLimit: number;
}

export interface ThatsNotAHatRoundEntry {
  playerId: number;
  penaltiesAdded: number;
  totalPenalties: number;
}

export interface ThatsNotAHatRound {
  roundNumber: number;
  note?: string;
  entries: ThatsNotAHatRoundEntry[];
}

export interface ThatsNotAHatState {
  kind: 'thats-not-a-hat';
  penalties: Record<number, number>;
  rounds: ThatsNotAHatRound[];
}

export interface ThatsNotAHatRoundInput {
  penaltiesAdded: Record<number, number>;
  note?: string;
}

export const thatsNotAHatGame: GameDefinition<
  ThatsNotAHatConfig,
  ThatsNotAHatState,
  ThatsNotAHatRoundInput
> = {
  slug: 'thats-not-a-hat',
  name: "That's Not a Hat",
  tagline: 'Hilarious memory & shameless bluffing gift-exchange game',
  description:
    'Pass face-down gifts around the table and remember (or convincingly bluff!) what each card is. Catch a bluff or misremember and someone takes a penalty point—lowest score wins when the threshold is hit!',
  rulesSummary: [
    'Whenever a bluff is called or fails, the losing player takes the gift card as 1 penalty point.',
    'Play continues until any player reaches the penalty threshold (official rule: 3 points).',
    'The player(s) with the FEWEST penalty points win!',
    'Supports both live round-by-round penalty tracking and quick post-game logging.',
  ],
  minPlayers: 3,
  maxPlayers: 8,
  supportedModes: ['scorecard', 'quick'],
  defaultMode: 'scorecard',
  scoringDirection: 'lowest_wins',
  themeColor: 'amber',
  iconName: 'hat',
  configFields: [
    {
      key: 'penaltyLimit',
      label: 'Game-Ending Penalty Threshold',
      description: 'Game ends once any player collects this many penalty cards (official: 3)',
      type: 'number',
      min: 2,
      max: 15,
      step: 1,
    },
  ],
  leaderboardColumns: [
    {
      key: 'flawlessGames',
      label: 'Flawless (0 Pts)',
      tooltip: 'Matches finished with 0 penalty cards taken',
      align: 'right',
      format: 'integer',
      aggregate: 'sum',
      statKey: 'flawlessGame',
    },
    {
      key: 'avgPenalties',
      label: 'Avg Penalties',
      tooltip: 'Average penalty cards taken per match',
      align: 'right',
      format: 'decimal',
      aggregate: 'avg',
      statKey: 'penaltiesTaken',
    },
  ],

  getDefaultConfig(): ThatsNotAHatConfig {
    return {
      penaltyLimit: 3,
    };
  },

  createInitialState(playerIds, _config, mode) {
    if (mode === 'quick') {
      return createEmptyQuickState(playerIds);
    }

    const penalties: Record<number, number> = {};
    for (const pid of playerIds) {
      penalties[pid] = 0;
    }

    return {
      kind: 'thats-not-a-hat',
      penalties,
      rounds: [],
    };
  },

  addRound(state, roundInput, playerIds) {
    let totalAddedThisRound = 0;
    const nextPenalties: Record<number, number> = { ...state.penalties };
    const entries: ThatsNotAHatRoundEntry[] = [];

    for (const pid of playerIds) {
      const added = Number(roundInput.penaltiesAdded?.[pid] ?? 0);
      if (!Number.isInteger(added) || added < 0) {
        throw new Error('Penalty cards added must be 0 or a positive integer.');
      }
      totalAddedThisRound += added;
      nextPenalties[pid] = (nextPenalties[pid] ?? 0) + added;
      entries.push({
        playerId: pid,
        penaltiesAdded: added,
        totalPenalties: nextPenalties[pid],
      });
    }

    if (totalAddedThisRound === 0) {
      throw new Error('At least 1 penalty point must be assigned in a round.');
    }

    return {
      kind: 'thats-not-a-hat',
      penalties: nextPenalties,
      rounds: [
        ...state.rounds,
        {
          roundNumber: state.rounds.length + 1,
          note: roundInput.note?.trim() || undefined,
          entries,
        },
      ],
    };
  },

  undoLastRound(state, playerIds) {
    if (state.rounds.length === 0) {
      return state;
    }

    const nextRounds = state.rounds.slice(0, -1);
    const prevRound = nextRounds[nextRounds.length - 1];
    const nextPenalties: Record<number, number> = {};

    for (const pid of playerIds) {
      nextPenalties[pid] =
        prevRound?.entries.find((e) => e.playerId === pid)?.totalPenalties ?? 0;
    }

    return {
      kind: 'thats-not-a-hat',
      penalties: nextPenalties,
      rounds: nextRounds,
    };
  },

  isGameComplete(state, playerIds, config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return true;
    }
    return playerIds.some(
      (pid) => (state.penalties[pid] ?? 0) >= config.penaltyLimit
    );
  },

  computeStandings(state, playerIds, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return computeQuickStandings(state as any, playerIds, 'penalties');
    }

    const items = playerIds.map((pid) => ({
      playerId: pid,
      penalties: state.penalties[pid] ?? 0,
    }));

    return rankEntries(
      items,
      (a, b) => a.penalties - b.penalties,
      (item, rank, isWinner) => ({
        playerId: item.playerId,
        rank,
        isWinner,
        score: item.penalties,
        scoreFormatted: `${item.penalties} pen.`,
        secondaryBadge:
          item.penalties === 0
            ? 'Flawless (0)'
            : `${item.penalties} card${item.penalties === 1 ? '' : 's'}`,
      })
    );
  },

  extractPlayerStats(state, playerId, standing, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return {
        penaltiesTaken: standing.score,
        flawlessGame: standing.score === 0 && standing.isWinner ? 1 : 0,
      };
    }

    const penaltiesTaken = state.penalties[playerId] ?? 0;
    return {
      penaltiesTaken,
      flawlessGame: state.rounds.length > 0 && penaltiesTaken === 0 ? 1 : 0,
      roundsPlayed: state.rounds.length,
    };
  },
};
