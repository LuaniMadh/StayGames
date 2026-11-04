import { GameDefinition } from '../types.js';
import {
  computeQuickStandings,
  createEmptyQuickState,
  isQuickState,
  rankEntries,
} from './helpers.js';

export interface PhaseInfo {
  number: number;
  title: string;
  requirement: string;
}

export const PHASE_10_PHASES: PhaseInfo[] = [
  { number: 1, title: 'Phase 1', requirement: '2 sets of 3' },
  { number: 2, title: 'Phase 2', requirement: '1 set of 3 + 1 run of 4' },
  { number: 3, title: 'Phase 3', requirement: '1 set of 4 + 1 run of 4' },
  { number: 4, title: 'Phase 4', requirement: '1 run of 7' },
  { number: 5, title: 'Phase 5', requirement: '1 run of 8' },
  { number: 6, title: 'Phase 6', requirement: '1 run of 9' },
  { number: 7, title: 'Phase 7', requirement: '2 sets of 4' },
  { number: 8, title: 'Phase 8', requirement: '7 cards of 1 color' },
  { number: 9, title: 'Phase 9', requirement: '1 set of 5 + 1 set of 2' },
  { number: 10, title: 'Phase 10', requirement: '1 set of 5 + 1 set of 3' },
];

export interface Phase10Config {
  phaseOrder: 'sequential' | 'free_choice';
}

export interface Phase10RoundEntry {
  playerId: number;
  pointsAdded: number;
  totalPoints: number;
  completedPhase: number | null; // 1..10 if a phase was completed this round
  completedPhasesAfter: number[];
}

export interface Phase10Round {
  roundNumber: number;
  entries: Phase10RoundEntry[];
}

export interface Phase10PlayerProgress {
  playerId: number;
  completedPhases: number[]; // e.g. [1, 2, 3]
  currentTargetPhase: number; // 1..10 (or 11 when all 10 complete)
  totalPoints: number;
}

export interface Phase10State {
  kind: 'phase-10';
  players: Record<number, Phase10PlayerProgress>;
  rounds: Phase10Round[];
}

export interface Phase10RoundInput {
  entries: Record<
    number,
    {
      pointsAdded: number;
      completed: boolean;
      phaseNumber?: number; // used in free_choice mode
    }
  >;
}

function getNextTargetPhase(completedPhases: number[]): number {
  for (let p = 1; p <= 10; p++) {
    if (!completedPhases.includes(p)) {
      return p;
    }
  }
  return 11;
}

export const phase10Game: GameDefinition<
  Phase10Config,
  Phase10State,
  Phase10RoundInput
> = {
  slug: 'phase-10',
  name: 'Phase 10',
  tagline: 'Rummy-style race through 10 challenging card combinations',
  description:
    'Race to complete all 10 phases before your friends! Leftover cards in your hand add penalty points—if two players finish Phase 10 in the same hand, the lowest score wins.',
  rulesSummary: [
    'Complete phases in order from 1 to 10 (or in any order in Floating/Free Choice mode).',
    'Players who complete their phase advance next hand; those who do not retry the same phase.',
    'Card penalty points: 1–9 = 5 pts, 10–12 = 10 pts, Skip = 15 pts, Wild = 25 pts.',
    'First player to complete Phase 10 wins (ties broken by lowest total penalty points).',
  ],
  minPlayers: 2,
  maxPlayers: 6,
  supportedModes: ['scorecard', 'quick'],
  defaultMode: 'scorecard',
  scoringDirection: 'lowest_wins',
  themeColor: 'emerald',
  iconName: 'layers',
  configFields: [
    {
      key: 'phaseOrder',
      label: 'Phase Progression Rule',
      description: 'Play phases strictly 1 → 10, or allow completing any uncompleted phase each hand',
      type: 'select',
      options: [
        { value: 'sequential', label: 'Classic Sequential (Phase 1 → 10)' },
        { value: 'free_choice', label: 'Floating / Free Choice (Any Phase)' },
      ],
    },
  ],
  leaderboardColumns: [
    {
      key: 'avgPhases',
      label: 'Avg Phases',
      tooltip: 'Average phases completed per match',
      align: 'right',
      format: 'decimal',
      aggregate: 'avg',
      statKey: 'phasesCompleted',
    },
    {
      key: 'fullClears',
      label: 'Phase 10 Clears',
      tooltip: 'Matches where all 10 phases were completed',
      align: 'right',
      format: 'integer',
      aggregate: 'sum',
      statKey: 'clearedAllTen',
    },
  ],

  getDefaultConfig(): Phase10Config {
    return {
      phaseOrder: 'sequential',
    };
  },

  createInitialState(playerIds, _config, mode) {
    if (mode === 'quick') {
      return createEmptyQuickState(playerIds);
    }

    const players: Record<number, Phase10PlayerProgress> = {};
    for (const pid of playerIds) {
      players[pid] = {
        playerId: pid,
        completedPhases: [],
        currentTargetPhase: 1,
        totalPoints: 0,
      };
    }

    return {
      kind: 'phase-10',
      players,
      rounds: [],
    };
  },

  addRound(state, roundInput, playerIds, config) {
    const roundNumber = state.rounds.length + 1;
    const nextPlayers: Record<number, Phase10PlayerProgress> = {};
    const roundEntries: Phase10RoundEntry[] = [];

    for (const pid of playerIds) {
      const prev = state.players[pid] ?? {
        playerId: pid,
        completedPhases: [],
        currentTargetPhase: 1,
        totalPoints: 0,
      };
      const input = roundInput.entries?.[pid];
      if (!input) {
        throw new Error('Round entry missing for one or more players.');
      }

      const pointsAdded = Number(input.pointsAdded);
      if (!Number.isFinite(pointsAdded) || pointsAdded < 0) {
        throw new Error('Penalty points must be 0 or a positive number.');
      }

      let completedPhase: number | null = null;
      let nextCompleted = [...prev.completedPhases];

      if (input.completed && prev.completedPhases.length < 10) {
        if (config.phaseOrder === 'free_choice' && input.phaseNumber) {
          const chosen = Number(input.phaseNumber);
          if (chosen < 1 || chosen > 10 || nextCompleted.includes(chosen)) {
            throw new Error(`Invalid or already completed phase ${chosen}.`);
          }
          completedPhase = chosen;
        } else {
          completedPhase = prev.currentTargetPhase;
        }

        if (completedPhase >= 1 && completedPhase <= 10) {
          nextCompleted = [...nextCompleted, completedPhase].sort((a, b) => a - b);
        }
      }

      const totalPoints = prev.totalPoints + pointsAdded;
      const currentTargetPhase = getNextTargetPhase(nextCompleted);

      nextPlayers[pid] = {
        playerId: pid,
        completedPhases: nextCompleted,
        currentTargetPhase,
        totalPoints,
      };

      roundEntries.push({
        playerId: pid,
        pointsAdded,
        totalPoints,
        completedPhase,
        completedPhasesAfter: nextCompleted,
      });
    }

    return {
      kind: 'phase-10',
      players: nextPlayers,
      rounds: [
        ...state.rounds,
        {
          roundNumber,
          entries: roundEntries,
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
    const nextPlayers: Record<number, Phase10PlayerProgress> = {};

    for (const pid of playerIds) {
      const entry = prevRound?.entries.find((e) => e.playerId === pid);
      const completedPhases = entry ? [...entry.completedPhasesAfter] : [];
      nextPlayers[pid] = {
        playerId: pid,
        completedPhases,
        currentTargetPhase: getNextTargetPhase(completedPhases),
        totalPoints: entry?.totalPoints ?? 0,
      };
    }

    return {
      kind: 'phase-10',
      players: nextPlayers,
      rounds: nextRounds,
    };
  },

  isGameComplete(state, playerIds, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return true;
    }
    return playerIds.some(
      (pid) => (state.players[pid]?.completedPhases.length ?? 0) >= 10
    );
  },

  computeStandings(state, playerIds, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return computeQuickStandings(state as any, playerIds, 'pts');
    }

    const items = playerIds.map((pid) => {
      const progress = state.players[pid] ?? {
        playerId: pid,
        completedPhases: [],
        currentTargetPhase: 1,
        totalPoints: 0,
      };
      return {
        playerId: pid,
        phasesCompleted: progress.completedPhases.length,
        currentTargetPhase: progress.currentTargetPhase,
        totalPoints: progress.totalPoints,
      };
    });

    return rankEntries(
      items,
      (a, b) =>
        b.phasesCompleted - a.phasesCompleted || a.totalPoints - b.totalPoints,
      (item, rank, isWinner) => ({
        playerId: item.playerId,
        rank,
        isWinner,
        score: item.totalPoints,
        scoreFormatted: `${item.totalPoints} pts`,
        secondaryBadge:
          item.phasesCompleted >= 10
            ? 'All 10 Phases ✓'
            : `Phase ${item.currentTargetPhase} (${item.phasesCompleted}/10)`,
      })
    );
  },

  extractPlayerStats(state, playerId, standing, _config, mode) {
    if (mode === 'quick' || isQuickState(state)) {
      return {
        phasesCompleted: standing.isWinner ? 10 : 0,
        clearedAllTen: standing.isWinner ? 1 : 0,
        penaltyPoints: standing.score,
      };
    }

    const progress = state.players[playerId];
    const phasesCompleted = progress?.completedPhases.length ?? 0;

    return {
      phasesCompleted,
      clearedAllTen: phasesCompleted >= 10 ? 1 : 0,
      penaltyPoints: progress?.totalPoints ?? standing.score,
      roundsPlayed: state.rounds.length,
    };
  },
};
