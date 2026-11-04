import { ConfigField, GameDefinition, GameMetadata } from '../types.js';
import {
  computeQuickStandings,
  createEmptyQuickState,
  isQuickState,
  rankEntries,
} from './helpers.js';

/**
 * Factory for simple "points per round" games.
 *
 * Use this to add a new game with a few lines of metadata — no custom engine
 * and no custom React scorecard needed (the client falls back to the generic
 * round-points scorecard for state kind 'simple-points').
 *
 * Example (in shared/games/index.ts):
 *   registerGame(createSimplePointsGame({ slug: 'skyjo', name: 'Skyjo', ... }));
 */

export interface SimplePointsConfig {
  targetScore: number; // 0 = no automatic end
  /** Optional per-session override (used by the miscellaneous game). */
  scoringDirection?: 'highest_wins' | 'lowest_wins';
  [key: string]: unknown;
}

export interface SimplePointsRound {
  roundNumber: number;
  points: Record<number, number>;
}

export interface SimplePointsState {
  kind: 'simple-points';
  totals: Record<number, number>;
  rounds: SimplePointsRound[];
}

export interface SimplePointsRoundInput {
  pointsByPlayer: Record<number, number>;
}

export type SimplePointsGameOptions = Pick<
  GameMetadata,
  'slug' | 'name' | 'tagline' | 'description' | 'minPlayers' | 'maxPlayers' | 'scoringDirection'
> &
  Partial<Pick<GameMetadata, 'rulesSummary' | 'themeColor' | 'iconName' | 'supportedModes' | 'defaultMode'>> & {
    defaultTargetScore?: number;
    allowNegative?: boolean;
    /** Additional config fields shown in the new-game form (rendered before the target score). */
    extraConfigFields?: ConfigField[];
    extraDefaults?: Record<string, unknown>;
    validateConfig?: (config: SimplePointsConfig) => void;
    getSessionTitle?: (config: SimplePointsConfig) => string | null;
  };

export function createSimplePointsGame(
  opts: SimplePointsGameOptions
): GameDefinition<SimplePointsConfig, SimplePointsState, SimplePointsRoundInput> {
  const isHighest = (config: SimplePointsConfig) =>
    (config.scoringDirection ?? opts.scoringDirection) === 'highest_wins';

  return {
    slug: opts.slug,
    name: opts.name,
    tagline: opts.tagline,
    description: opts.description,
    rulesSummary: opts.rulesSummary ?? [],
    minPlayers: opts.minPlayers,
    maxPlayers: opts.maxPlayers,
    supportedModes: opts.supportedModes ?? ['scorecard', 'quick'],
    defaultMode: opts.defaultMode ?? 'scorecard',
    scoringDirection: opts.scoringDirection,
    themeColor: opts.themeColor ?? 'violet',
    iconName: opts.iconName ?? 'dice',
    configFields: [
      ...(opts.extraConfigFields ?? []),
      {
        key: 'targetScore',
        label: 'End at score',
        description: 'Game can be finished once any player reaches this total (0 = finish manually)',
        type: 'number',
        min: 0,
        max: 10000,
        step: 10,
      },
    ],
    leaderboardColumns: [],

    getDefaultConfig() {
      return { targetScore: opts.defaultTargetScore ?? 0, ...(opts.extraDefaults ?? {}) };
    },
    validateConfig: opts.validateConfig,
    getSessionTitle: opts.getSessionTitle,

    createInitialState(playerIds, _config, mode) {
      if (mode === 'quick') return createEmptyQuickState(playerIds);
      return {
        kind: 'simple-points',
        totals: Object.fromEntries(playerIds.map((p) => [p, 0])),
        rounds: [],
      };
    },

    addRound(state, input, playerIds) {
      const points: Record<number, number> = {};
      const totals = { ...state.totals };
      for (const pid of playerIds) {
        const v = Number(input.pointsByPlayer?.[pid] ?? 0);
        if (!Number.isFinite(v) || (!opts.allowNegative && v < 0)) {
          throw new Error('Invalid points value.');
        }
        points[pid] = v;
        totals[pid] = (totals[pid] ?? 0) + v;
      }
      return {
        kind: 'simple-points',
        totals,
        rounds: [...state.rounds, { roundNumber: state.rounds.length + 1, points }],
      };
    },

    editRound(state, roundNumber, input, playerIds) {
      if (!state.rounds.some((r) => r.roundNumber === roundNumber)) {
        throw new Error(`Round ${roundNumber} has not been played yet.`);
      }
      const totals: Record<number, number> = Object.fromEntries(playerIds.map((p) => [p, 0]));
      const rounds = state.rounds.map((r) => {
        let points = r.points;
        if (r.roundNumber === roundNumber) {
          points = {};
          for (const pid of playerIds) {
            const v = Number(input.pointsByPlayer?.[pid] ?? 0);
            if (!Number.isFinite(v) || (!opts.allowNegative && v < 0)) {
              throw new Error('Invalid points value.');
            }
            points[pid] = v;
          }
        }
        for (const pid of playerIds) totals[pid] += points[pid] ?? 0;
        return { ...r, points };
      });
      return { kind: 'simple-points', totals, rounds };
    },

    undoLastRound(state, playerIds) {
      if (state.rounds.length === 0) return state;
      const rounds = state.rounds.slice(0, -1);
      const totals: Record<number, number> = Object.fromEntries(playerIds.map((p) => [p, 0]));
      for (const r of rounds) for (const pid of playerIds) totals[pid] += r.points[pid] ?? 0;
      return { kind: 'simple-points', totals, rounds };
    },

    isGameComplete(state, playerIds, config, mode) {
      if (mode === 'quick' || isQuickState(state)) return true;
      if (!config.targetScore) return state.rounds.length > 0;
      return playerIds.some((p) => (state.totals[p] ?? 0) >= config.targetScore);
    },

    computeStandings(state, playerIds, config, mode) {
      if (mode === 'quick' || isQuickState(state)) {
        return computeQuickStandings(state as any, playerIds, 'pts');
      }
      const highest = isHighest(config);
      const items = playerIds.map((pid) => ({ playerId: pid, score: state.totals[pid] ?? 0 }));
      return rankEntries(
        items,
        (a, b) => (highest ? b.score - a.score : a.score - b.score),
        (item, rank, isWinner) => ({
          playerId: item.playerId,
          rank,
          isWinner,
          score: item.score,
          scoreFormatted: `${item.score} pts`,
        })
      );
    },

    extractPlayerStats(state, _playerId, standing, _config, mode) {
      return {
        finalScore: standing.score,
        roundsPlayed: mode === 'quick' || isQuickState(state) ? 0 : state.rounds.length,
      };
    },
  };
}
