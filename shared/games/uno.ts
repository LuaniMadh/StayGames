import { GameDefinition } from '../types.js';
import {
  computeQuickStandings,
  createEmptyQuickState,
  isQuickState,
  rankEntries,
} from './helpers.js';

export interface UnoConfig {
  targetScore: number;
  scoringVariant: 'winner_collects' | 'penalty_lowest';
}

export interface UnoRoundEntry {
  playerId: number;
  pointsAdded: number;
  cumulativeScore: number;
}

export interface UnoRound {
  roundNumber: number;
  roundWinnerId: number;
  entries: UnoRoundEntry[];
}

export interface UnoState {
  kind: 'uno';
  totals: Record<number, number>;
  rounds: UnoRound[];
}

export interface UnoRoundInput {
  roundWinnerId: number;
  pointsByPlayer: Record<number, number>;
}

export const unoGame: GameDefinition<UnoConfig, UnoState, UnoRoundInput> = {
  slug: 'uno',
  name: 'Uno',
  tagline: 'Fast-paced color & action card shedding classic',
  description:
    'Log a quick single-hand winner or track multi-hand cumulative points up to 500! Supports both official Winner-Collects scoring and Penalty-Hand house rules.',
  rulesSummary: [
    'Quick Mode: Instantly record placements after a single game or tournament.',
    'Scorecard Mode (Official): Hand winner scores the sum of all opponents’ remaining cards; first to 500 wins.',
    'Scorecard Mode (Penalty House Rule): Players add their own leftover hand points; lowest score wins when someone hits 500.',
    'Card values: 0–9 = face value, +2 / Reverse / Skip = 20 pts, Wild / Wild +4 = 50 pts.',
  ],
  minPlayers: 2,
  maxPlayers: 10,
  supportedModes: ['quick', 'scorecard'],
  defaultMode: 'scorecard',
  scoringDirection: 'highest_wins',
  themeColor: 'rose',
  iconName: 'flame',
  configFields: [
    {
      key: 'targetScore',
      label: 'Target Score Threshold',
      description: 'Match ends once any player reaches or exceeds this point total (standard: 500)',
      type: 'number',
      min: 50,
      max: 2000,
      step: 50,
    },
    {
      key: 'scoringVariant',
      label: 'Scoring Rule',
      description: 'Official rules award points to the hand winner; Penalty mode gives points to players holding cards',
      type: 'select',
      options: [
        {
          value: 'winner_collects',
          label: 'Official: Hand Winner Collects Points (Highest Wins)',
        },
        {
          value: 'penalty_lowest',
          label: 'House Rule: Keep Leftover Penalty Points (Lowest Wins)',
        },
      ],
    },
  ],
  leaderboardColumns: [
    {
      key: 'handsWon',
      label: 'Hands Won',
      tooltip: 'Total individual Uno hands won in scorecard matches',
      align: 'right',
      format: 'integer',
      aggregate: 'sum',
      statKey: 'handsWon',
    },
  ],

  getDefaultConfig(): UnoConfig {
    return {
      targetScore: 500,
      scoringVariant: 'winner_collects',
    };
  },

  createInitialState(playerIds, _config, mode) {
    if (mode === 'quick') {
      return createEmptyQuickState(playerIds);
    }

    const totals: Record<number, number> = {};
    for (const pid of playerIds) {
      totals[pid] = 0;
    }

    return {
      kind: 'uno',
      totals,
      rounds: [],
    };
  },

  addRound(state, roundInput, playerIds, config) {
    if (!playerIds.includes(roundInput.roundWinnerId)) {
      throw new Error('Please select a valid hand winner.');
    }

    const nextTotals: Record<number, number> = { ...state.totals };
    const entries: UnoRoundEntry[] = [];

    if (config.scoringVariant === 'winner_collects') {
      const winnerPts = Number(
        roundInput.pointsByPlayer?.[roundInput.roundWinnerId] ?? 0
      );
      if (!Number.isFinite(winnerPts) || winnerPts < 0) {
        throw new Error('Points earned must be 0 or greater.');
      }

      for (const pid of playerIds) {
        const added = pid === roundInput.roundWinnerId ? winnerPts : 0;
        nextTotals[pid] = (nextTotals[pid] ?? 0) + added;
        entries.push({
          playerId: pid,
          pointsAdded: added,
          cumulativeScore: nextTotals[pid],
        });
      }
    } else {
      for (const pid of playerIds) {
        const raw =
          pid === roundInput.roundWinnerId
            ? 0
            : Number(roundInput.pointsByPlayer?.[pid] ?? 0);
        if (!Number.isFinite(raw) || raw < 0) {
          throw new Error('Penalty points must be 0 or greater.');
        }
        nextTotals[pid] = (nextTotals[pid] ?? 0) + raw;
        entries.push({
          playerId: pid,
          pointsAdded: raw,
          cumulativeScore: nextTotals[pid],
        });
      }
    }

    return {
      kind: 'uno',
      totals: nextTotals,
      rounds: [
        ...state.rounds,
        {
          roundNumber: state.rounds.length + 1,
          roundWinnerId: roundInput.roundWinnerId,
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
    const nextTotals: Record<number, number> = {};

    for (const pid of playerIds) {
      nextTotals[pid] =
        prevRound?.entries.find((e) => e.playerId === pid)?.cumulativeScore ?? 0;
    }

    return {
      kind: 'uno',
      totals: nextTotals,
      rounds: nextRounds,
    };
  },

  isGameComplete(state, playerIds, config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return true;
    }
    return playerIds.some(
      (pid) => (state.totals[pid] ?? 0) >= config.targetScore
    );
  },

  computeStandings(state, playerIds, config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return computeQuickStandings(state as any, playerIds, 'pts');
    }

    const items = playerIds.map((pid) => {
      const score = state.totals[pid] ?? 0;
      const handsWon = state.rounds.filter(
        (r) => r.roundWinnerId === pid
      ).length;
      return {
        playerId: pid,
        score,
        handsWon,
      };
    });

    const highestWins = config.scoringVariant !== 'penalty_lowest';

    return rankEntries(
      items,
      (a, b) =>
        highestWins
          ? b.score - a.score || b.handsWon - a.handsWon
          : a.score - b.score || b.handsWon - a.handsWon,
      (item, rank, isWinner) => ({
        playerId: item.playerId,
        rank,
        isWinner,
        score: item.score,
        scoreFormatted: `${item.score} pts`,
        secondaryBadge: `${item.handsWon} hand${item.handsWon === 1 ? '' : 's'} won`,
      })
    );
  },

  extractPlayerStats(state, playerId, standing, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return {
        handsWon: standing.isWinner ? 1 : 0,
        finalScore: standing.score,
      };
    }

    const handsWon = state.rounds.filter(
      (r) => r.roundWinnerId === playerId
    ).length;

    return {
      handsWon,
      roundsPlayed: state.rounds.length,
      finalScore: standing.score,
    };
  },
};
