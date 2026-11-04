import { Router } from 'express';
import {
  compilePluginCode,
  getPluginBySlug,
  installOrUpdatePlugin,
  listPlugins,
  uninstallPlugin,
} from '../services/pluginService.js';
import { toGameMetadata } from '../../shared/games/index.js';
import { requireAuth } from '../middleware/auth.js';

export const pluginDocRouter = Router();
export const pluginsRouter = Router();

const SAMPLE_PLUGIN_HANABI = `module.exports = function(helpers) {
  return {
    slug: 'hanabi',
    name: 'Hanabi',
    tagline: 'Cooperative fireworks card challenge',
    description: 'Players hold their cards facing outward and work together as a team to assemble 5 fireworks series (numbers 1-5 in each color) before running out of cards or suffering 3 strikes.',
    gameType: 'cooperative',
    cooperative: true,
    minPlayers: 2,
    maxPlayers: 5,
    supportedModes: ['scorecard', 'quick'],
    defaultMode: 'scorecard',
    scoringDirection: 'highest_wins',
    themeColor: 'cyan',
    iconName: 'flame',
    rulesSummary: [
      'Cards are held facing your teammates, never yourself.',
      'Spend Clue Tokens (starts at 8) to give information about colors or numbers.',
      'Discarding a card recovers 1 Clue Token (max 8).',
      'Playing an invalid card triggers a fuse strike (3 strikes = explosion and team loss).',
      'The game ends on 3 strikes, when reaching 25 fireworks points, or after the deck runs out.'
    ],
    configFields: [
      { key: 'targetScore', label: 'Victory Goal (Score)', type: 'number', min: 10, max: 25, default: 25, description: '25 points represents a legendary perfect fireworks show' }
    ],
    // Turn actions rendered as a 1-tap horizontal button group (radio buttons)
    roundInputFields: [
      {
        key: 'action',
        label: 'Turn Action',
        type: 'radio',
        display: 'buttons',
        options: [
          { value: 'correct_play', label: 'Correct Fireworks Play (+1 pt)' },
          { value: 'strike', label: 'Misplay / Strike (+1 strike)' },
          { value: 'give_clue', label: 'Give Clue (-1 clue)' },
          { value: 'discard', label: 'Discard Card (+1 clue)' }
        ],
        default: 'correct_play'
      }
    ],
    // Custom scoreboard table columns displaying user-friendly labels and running stats
    scoreboardColumns: [
      { key: 'action', label: 'Turn Action', align: 'left' },
      { key: 'remainingClues', label: 'Remaining Clues', align: 'center', format: 'integer' },
      { key: 'currentErrors', label: 'Current Errors', align: 'center', format: 'integer' },
      { key: 'teamScore', label: 'Fireworks Score', align: 'right', format: 'integer' }
    ],
    // Visual progress charts rendered automatically in the session view
    charts: [
      {
        key: 'hintHistory',
        title: 'Available Hints History',
        type: 'line',
        dataKey: 'hintHistory',
        yAxisMin: 0,
        yAxisMax: 8,
        color: '#38bdf8'
      },
      {
        key: 'scoreHistory',
        title: 'Fireworks Progress',
        type: 'line',
        dataKey: 'scoreHistory',
        yAxisMin: 0,
        yAxisMax: 25,
        color: '#f59e0b'
      }
    ],
    leaderboardColumns: [
      { key: 'bestScore', label: 'Best Score', format: 'integer', aggregate: 'max', statKey: 'teamScore' },
      { key: 'strikes', label: 'Total Strikes', format: 'integer', aggregate: 'sum', statKey: 'strikes' }
    ],
    getDefaultConfig: function() {
      return { targetScore: 25 };
    },
    createInitialState: function(playerIds, config, mode) {
      if (mode === 'quick') return helpers.createEmptyQuickState(playerIds);
      return {
        kind: 'hanabi',
        teamScore: 0,
        clues: 8,
        strikes: 0,
        hintHistory: [8],
        scoreHistory: [0],
        rounds: []
      };
    },
    addRound: function(state, roundInput, playerIds, config) {
      var action = roundInput.action || 'correct_play';
      var ptsAdded = action === 'correct_play' ? 1 : 0;
      var nextScore = Math.min(25, (state.teamScore || 0) + ptsAdded);
      var nextClues = state.clues !== undefined ? state.clues : 8;

      if (action === 'give_clue') {
        nextClues = Math.max(0, nextClues - 1);
      } else if (action === 'discard') {
        nextClues = Math.min(8, nextClues + 1);
      }

      var nextStrikes = (state.strikes || 0) + (action === 'strike' ? 1 : 0);

      var roundEntry = {
        roundNumber: (state.rounds ? state.rounds.length : 0) + 1,
        action: action,
        teamScore: nextScore,
        remainingClues: nextClues,
        currentErrors: nextStrikes,
        input: roundInput
      };

      return {
        kind: 'hanabi',
        teamScore: nextScore,
        clues: nextClues,
        strikes: nextStrikes,
        hintHistory: (state.hintHistory || [8]).concat([nextClues]),
        scoreHistory: (state.scoreHistory || [0]).concat([nextScore]),
        rounds: (state.rounds || []).concat([roundEntry])
      };
    },
    undoLastRound: function(state, playerIds, config) {
      if (!state.rounds || state.rounds.length === 0) return state;
      var rounds = state.rounds.slice(0, -1);
      var prevRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

      return {
        kind: 'hanabi',
        teamScore: prevRound ? prevRound.teamScore : 0,
        clues: prevRound ? prevRound.remainingClues : 8,
        strikes: prevRound ? prevRound.currentErrors : 0,
        hintHistory: (state.hintHistory || [8]).slice(0, -1),
        scoreHistory: (state.scoreHistory || [0]).slice(0, -1),
        rounds: rounds
      };
    },
    isGameComplete: function(state, playerIds, config, mode) {
      if (helpers.isQuickState(state)) return true;
      if (state.strikes >= 3) return true;
      if (state.teamScore >= 25) return true;
      return false;
    },
    computeStandings: function(state, playerIds, config, mode) {
      if (helpers.isQuickState(state)) return helpers.computeQuickStandings(state, playerIds);
      var isBomb = (state.strikes || 0) >= 3;
      var isWin = !isBomb && state.teamScore >= (config.targetScore || 18);
      var badge = isBomb
        ? 'Explosion (3 Strikes) - Defeat'
        : state.teamScore === 25
        ? 'Legendary! (25/25 pts)'
        : (state.teamScore + '/25 Fireworks Points');

      return helpers.createCooperativeStandings(playerIds, state.teamScore || 0, {
        isWin: isWin,
        secondaryBadge: badge
      });
    },
    extractPlayerStats: function(state, playerId, standing, config, mode) {
      return {
        teamScore: state.teamScore || 0,
        strikes: state.strikes || 0,
        cluesRemaining: state.clues !== undefined ? state.clues : 8,
        roundsPlayed: helpers.isQuickState(state) ? 0 : (state.rounds ? state.rounds.length : 0),
        finalScore: standing.score
      };
    }
  };
};`;

const PLUGIN_SPECIFICATION = {
  version: '1.2.0',
  description: 'StayGames Plugin API Specification: Competitive & Cooperative Game Modules with Visual Analytics',
  sandbox: {
    runtime: 'CommonJS sandboxed context (Node.js vm)',
    exportStyle: 'module.exports = function(helpers) { return gameDefinition; } or module.exports = gameDefinition;',
    timeoutMs: 2000,
    injectedGlobals: ['Math', 'Date', 'Object', 'Array', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'console'],
  },
  manifestFields: [
    { name: 'slug', type: 'string', required: true, description: 'Unique identifier for the game (lowercase letters, numbers, hyphens, underscores)' },
    { name: 'name', type: 'string', required: true, description: 'Display name of the game' },
    { name: 'tagline', type: 'string', required: true, description: 'Short catchphrase or tagline' },
    { name: 'description', type: 'string', required: true, description: 'Full description of the game' },
    { name: 'rulesSummary', type: 'string[]', required: false, description: 'Array of concise rule bullets shown on game setup' },
    { name: 'minPlayers', type: 'number', required: true, description: 'Minimum number of players (>= 1)' },
    { name: 'maxPlayers', type: 'number', required: true, description: 'Maximum number of players (>= minPlayers)' },
    { name: 'supportedModes', type: '("scorecard" | "quick")[]', required: true, description: 'Supported game modes' },
    { name: 'defaultMode', type: '"scorecard" | "quick"', required: true, description: 'Default mode when starting session' },
    { name: 'scoringDirection', type: '"highest_wins" | "lowest_wins"', required: true, description: 'Determines leaderboard and placement sorting' },
    { name: 'gameType', type: '"competitive" | "cooperative" | "team"', required: false, description: 'Game paradigm. Cooperative games feature a single shared team score and outcome.' },
    { name: 'cooperative', type: 'boolean', required: false, description: 'Shorthand flag: when true, UI renders shared team inputs and cooperative standings.' },
    { name: 'themeColor', type: '"indigo" | "emerald" | "amber" | "rose" | "violet" | "cyan"', required: false, description: 'UI accent color for cards and banners' },
    { name: 'iconName', type: '"wand" | "layers" | "flame" | "hat" | "dice"', required: false, description: 'Icon identifier for the game badge' },
    { name: 'configFields', type: 'ConfigField[]', required: false, description: 'Custom session options configured at new game start' },
    { name: 'roundInputFields', type: 'ConfigField[]', required: false, description: 'Custom round input fields shown in Add Round dialog (e.g. clues, strikes, cards played)' },
    { name: 'roundFields', type: 'ConfigField[]', required: false, description: 'Alias for roundInputFields' },
    { name: 'scoreboardColumns', type: 'ScoreboardColumnDef[]', required: false, description: 'Custom columns displayed in the active session scoreboard table' },
    { name: 'roundTableColumns', type: 'ScoreboardColumnDef[]', required: false, description: 'Alias for scoreboardColumns' },
    { name: 'charts', type: 'ChartDef[]', required: false, description: 'Visual progress charts (line, bar) rendered in session view' },
    { name: 'leaderboardColumns', type: 'LeaderboardColumnDef[]', required: false, description: 'Custom aggregate stat columns shown on the leaderboard' },
  ],
  types: {
    ConfigField: {
      description: 'Defines interactive form inputs for session configuration and round input dialogs. Options values are automatically resolved to their user-friendly labels in scoreboard tables.',
      properties: [
        { key: 'key', type: 'string', required: true, description: 'Property key name in the config or roundInput payload' },
        { key: 'label', type: 'string', required: true, description: 'User-facing label displayed in the UI' },
        { key: 'description', type: 'string', required: false, description: 'Optional helper text or tooltip' },
        { key: 'type', type: '"number" | "boolean" | "select" | "text" | "radio"', required: true, description: 'Field control type. Use "radio" for a 1-tap button group.' },
        { key: 'display', type: '"buttons" | "dropdown" | "segmented"', required: false, description: 'Layout widget preference ("buttons" renders segmented button bar)' },
        { key: 'widget', type: '"buttons" | "segmented" | "dropdown"', required: false, description: 'Alias for display' },
        { key: 'default', type: 'number | string | boolean', required: false, description: 'Initial default value' },
        { key: 'required', type: 'boolean', required: false, description: 'Whether the field must be non-empty' },
        { key: 'placeholder', type: 'string', required: false, description: 'Placeholder for text inputs' },
        { key: 'min', type: 'number', required: false, description: 'Minimum number value for type "number"' },
        { key: 'max', type: 'number', required: false, description: 'Maximum number value for type "number"' },
        { key: 'step', type: 'number', required: false, description: 'Step increment for number stepper' },
        { key: 'options', type: '({ value: string, label: string } | string)[]', required: false, description: 'List of options. The UI displays "label" in tables and submits "value" in data payloads.' },
        { key: 'showInQuickMode', type: 'boolean', required: false, description: 'Also display this field during quick placement mode' },
      ],
    },
    ScoreboardColumnDef: {
      description: 'Defines custom columns rendered in the session scoreboard table.',
      properties: [
        { key: 'key', type: 'string', required: true, description: 'Property key on round record or round.input' },
        { key: 'label', type: 'string', required: true, description: 'Column header title' },
        { key: 'align', type: '"left" | "right" | "center"', required: false, description: 'Text alignment' },
        { key: 'format', type: '"integer" | "decimal" | "text" | "badge"', required: false, description: 'Display formatting ("badge" wraps in styled pill)' },
      ],
    },
    ChartDef: {
      description: 'Defines visual progression sparklines and charts rendered in the session dashboard.',
      properties: [
        { key: 'key', type: 'string', required: true, description: 'Unique chart key' },
        { key: 'title', type: 'string', required: true, description: 'Chart display title' },
        { key: 'type', type: '"line" | "bar"', required: true, description: 'Chart visualization type' },
        { key: 'dataKey', type: 'string', required: true, description: 'Array property on state (e.g. "hintHistory" or "scoreHistory") or round property' },
        { key: 'yAxisMin', type: 'number', required: false, description: 'Fixed Y-axis minimum (e.g. 0)' },
        { key: 'yAxisMax', type: 'number', required: false, description: 'Fixed Y-axis maximum (e.g. 8 for clues, 25 for fireworks)' },
        { key: 'color', type: 'string', required: false, description: 'Hex or theme color for the chart line/area' },
      ],
    },
    LeaderboardColumnDef: {
      description: 'Defines custom aggregate columns displayed on game-specific leaderboards.',
      properties: [
        { key: 'key', type: 'string', required: true, description: 'Unique identifier for the column' },
        { key: 'label', type: 'string', required: true, description: 'Header title on the leaderboard table' },
        { key: 'tooltip', type: 'string', required: false, description: 'Tooltip explanation of the statistic' },
        { key: 'align', type: '"left" | "right" | "center"', required: false, description: 'Column text alignment' },
        { key: 'format', type: '"integer" | "decimal" | "percent"', required: true, description: 'Numeric display formatting' },
        { key: 'aggregate', type: '"sum" | "max" | "min" | "avg" | "ratio_percent"', required: true, description: 'Aggregation function over player session records' },
        { key: 'statKey', type: 'string', required: true, description: 'Field name inside session_players.stats_json' },
        { key: 'denominatorStatKey', type: 'string', required: false, description: 'Required for aggregate "ratio_percent"' },
      ],
    },
    StandingEntry: {
      description: 'Item returned in computeStandings() representing a player’s outcome.',
      properties: [
        { key: 'playerId', type: 'number', required: true, description: 'Player ID' },
        { key: 'rank', type: 'number', required: true, description: 'Ordinal placement (1 for winner/first, or 1 for all teammates in cooperative games)' },
        { key: 'isWinner', type: 'boolean', required: true, description: 'True if player won (or team achieved victory)' },
        { key: 'score', type: 'number', required: true, description: 'Numeric final score used for sorting' },
        { key: 'scoreFormatted', type: 'string', required: true, description: 'Human-readable score string (e.g. "25 pts", "Place #1")' },
        { key: 'secondaryBadge', type: 'string', required: false, description: 'Optional text badge (e.g. "Team Victory", "3 Strikes - Defeat")' },
      ],
    },
    TRoundInput: {
      description: 'Payload received by addRound(state, roundInput, playerIds, config).',
      competitiveSchema: '{ pointsByPlayer: Record<number, number>, ...customRoundFields }',
      cooperativeSchema: '{ teamScore: number, pointsByPlayer?: Record<number, number>, ...customRoundFields }',
    },
    TState: {
      description: 'Session state persisted in MySQL and passed to lifecycle hooks.',
      genericPointsState: '{ kind: "simple-points", totals: Record<number, number>, rounds: Array<{ roundNumber: number, points: Record<number, number> }> }',
      cooperativeState: '{ kind: string, teamScore: number, rounds: Array<{ roundNumber: number, teamScore: number, input: any }>, clues?: number, strikes?: number, hintHistory?: number[], scoreHistory?: number[] }',
    },
  },
  lifecycleHooks: [
    { name: 'getDefaultConfig(playerCount: number)', returnType: 'TConfig', description: 'Returns initial config object for a new game session' },
    { name: 'createInitialState(playerIds: number[], config: TConfig, mode: "scorecard" | "quick")', returnType: 'TState', description: 'Initializes the game state when a new session starts' },
    { name: 'addRound(state: TState, roundInput: TRoundInput, playerIds: number[], config: TConfig)', returnType: 'TState', description: 'Appends a round and computes updated totals' },
    { name: 'undoLastRound(state: TState, playerIds: number[], config: TConfig)', returnType: 'TState', description: 'Reverts the last recorded round' },
    { name: 'editRound?(state: TState, roundNumber: number, roundInput: TRoundInput, playerIds: number[], config: TConfig)', returnType: 'TState', description: 'Optional: updates an existing round in-place and recalculates state' },
    { name: 'isGameComplete(state: TState, playerIds: number[], config: TConfig, mode: "scorecard" | "quick")', returnType: 'boolean', description: 'Returns true when the game end condition has been reached' },
    { name: 'computeStandings(state: TState, playerIds: number[], config: TConfig, mode: "scorecard" | "quick")', returnType: 'StandingEntry[]', description: 'Computes current rankings, scores, and winner status for all players' },
    { name: 'extractPlayerStats(state: TState, playerId: number, standing: StandingEntry, config: TConfig, mode: "scorecard" | "quick")', returnType: 'Record<string, number | string | boolean | null>', description: 'Extracts statistics stored for the player session record' },
    { name: 'validateConfig?(config: TConfig)', returnType: 'void', description: 'Optional: validates config values, throws error if invalid' },
    { name: 'getSessionTitle?(config: TConfig)', returnType: 'string | null', description: 'Optional: dynamically overrides session title based on configuration' },
  ],
  helpers: [
    {
      name: 'createCooperativeStandings(playerIds, teamScore, options)',
      description: 'Creates shared cooperative standings where all players share the same team score and outcome.',
      signature: 'createCooperativeStandings(playerIds: number[], teamScore: number, options?: { isWin?: boolean, rank?: number, secondaryBadge?: string, scoreFormatted?: string, unitLabel?: string }): StandingEntry[]',
    },
    {
      name: 'rankEntries(entries, options)',
      description: 'Sorts player scores and assigns ranks with tie-breaking, or evaluates cooperative outcomes.',
      signature: 'rankEntries(entries: Array<{ playerId: number, score?: number }>, options?: { scoringDirection?: "highest_wins" | "lowest_wins", cooperative?: boolean, unitLabel?: string, isWinner?: (item, rank) => boolean, compare?: (a, b) => number, formatScore?: (score) => string }): StandingEntry[]',
    },
    { name: 'createSimplePointsGame(options)', description: 'Factory to create an entire round-based points game with automatic end-of-game checks and standing calculations' },
    { name: 'computeQuickStandings(state, playerIds)', description: 'Standard standings calculation for quick placement mode' },
    { name: 'createEmptyQuickState(playerIds)', description: 'Creates an initial quick mode state' },
    { name: 'isQuickState(state)', description: 'Returns true if state is in quick-placement format' },
  ],
  restEndpoints: [
    { method: 'GET', path: '/plugins/api', access: 'Public (No Auth)', description: 'Returns this documentation (JSON or HTML)' },
    { method: 'POST', path: '/plugins/api/validate', access: 'Public (No Auth)', description: 'Unauthenticated sandbox dry-run validation for CI, scripts, and local testing' },
    { method: 'GET', path: '/api/plugins', access: 'Authenticated', description: 'Lists all installed game plugins' },
    { method: 'POST', path: '/api/plugins', access: 'Authenticated', description: 'Uploads and activates a new game plugin' },
    { method: 'POST', path: '/api/plugins/validate', access: 'Authenticated', description: 'Validates plugin code without installing it' },
    { method: 'GET', path: '/api/plugins/:slug', access: 'Authenticated', description: 'Retrieves source code and metadata of an installed plugin' },
    { method: 'DELETE', path: '/api/plugins/:slug', access: 'Authenticated', description: 'Deletes and unregisters an installed game plugin' },
  ],
  cooperativeGuidance: {
    overview: 'Cooperative games (such as Hanabi, Pandemic, The Crew) unite all participants into a single team outcome. Set "cooperative": true or "gameType": "cooperative" in the manifest.',
    uiBehavior: 'The scorecard UI prompts for a single Team Score / Round Points input instead of individual player columns. When roundInputFields are defined, controls for custom actions (clues, strikes, events) are rendered dynamically.',
    singleVsMultiRound: 'Games can be scored incrementally each round or in a single final tally. Single-round games simply record the final team score and any tokens in Round 1, then finish the game.',
    standings: 'Use helpers.createCooperativeStandings(playerIds, teamScore, { isWin, secondaryBadge }) so all players receive Rank 1 and share the team victory/defeat outcome.',
  },
  samplePluginHanabi: SAMPLE_PLUGIN_HANABI,
  samplePluginSimple: `module.exports = function(helpers) {
  return helpers.createSimplePointsGame({
    slug: 'skyjo',
    name: 'Skyjo',
    tagline: 'Keep your score as low as possible!',
    description: 'Skyjo is a popular card game where players swap and flip cards over multiple rounds to achieve the lowest total score.',
    minPlayers: 2,
    maxPlayers: 8,
    scoringDirection: 'lowest_wins',
    defaultTargetScore: 100,
    themeColor: 'emerald',
    iconName: 'layers',
    rulesSummary: [
      'Each player has 12 face-down cards in a 3x4 grid.',
      'Reveal and swap cards each turn to minimize your point total.',
      'The round ends when a player reveals all their cards.',
      'Game finishes when any player reaches or exceeds 100 points.'
    ]
  });
};`,
  samplePluginCustom: `module.exports = function(helpers) {
  return {
    slug: 'coin-toss-championship',
    name: 'Coin Toss Championship',
    tagline: 'Simple heads-or-tails point competition',
    description: 'Players guess heads or tails each round. Correct guesses earn a point!',
    rulesSummary: ['Each round, players score 1 point if they guessed correctly.', 'First to 5 points wins.'],
    minPlayers: 2,
    maxPlayers: 10,
    supportedModes: ['scorecard', 'quick'],
    defaultMode: 'scorecard',
    scoringDirection: 'highest_wins',
    themeColor: 'amber',
    iconName: 'dice',
    configFields: [
      { key: 'targetScore', label: 'Winning Score', type: 'number', min: 1, max: 50 }
    ],
    leaderboardColumns: [
      { key: 'rounds', label: 'Rounds', format: 'integer', aggregate: 'sum', statKey: 'roundsPlayed' }
    ],
    getDefaultConfig: function() {
      return { targetScore: 5 };
    },
    createInitialState: function(playerIds, config, mode) {
      if (mode === 'quick') return helpers.createEmptyQuickState(playerIds);
      var totals = {};
      for (var i = 0; i < playerIds.length; i++) totals[playerIds[i]] = 0;
      return { kind: 'simple-points', totals: totals, rounds: [] };
    },
    addRound: function(state, roundInput, playerIds, config) {
      var nextTotals = Object.assign({}, state.totals);
      var points = (roundInput && roundInput.pointsByPlayer) || {};
      for (var i = 0; i < playerIds.length; i++) {
        var pid = playerIds[i];
        nextTotals[pid] = (nextTotals[pid] || 0) + (points[pid] || 0);
      }
      var round = { roundNumber: state.rounds.length + 1, points: points };
      return { kind: 'simple-points', totals: nextTotals, rounds: state.rounds.concat([round]) };
    },
    undoLastRound: function(state, playerIds, config) {
      if (!state.rounds || state.rounds.length === 0) return state;
      var last = state.rounds[state.rounds.length - 1];
      var nextTotals = Object.assign({}, state.totals);
      for (var i = 0; i < playerIds.length; i++) {
        var pid = playerIds[i];
        nextTotals[pid] = (nextTotals[pid] || 0) - (last.points[pid] || 0);
      }
      return { kind: 'simple-points', totals: nextTotals, rounds: state.rounds.slice(0, -1) };
    },
    isGameComplete: function(state, playerIds, config, mode) {
      if (helpers.isQuickState(state)) return true;
      var target = (config && config.targetScore) || 5;
      for (var i = 0; i < playerIds.length; i++) {
        if ((state.totals[playerIds[i]] || 0) >= target) return true;
      }
      return false;
    },
    computeStandings: function(state, playerIds, config, mode) {
      if (helpers.isQuickState(state)) return helpers.computeQuickStandings(state, playerIds);
      var entries = playerIds.map(function(pid) {
        return { playerId: pid, score: state.totals[pid] || 0 };
      });
      return helpers.rankEntries(entries, { scoringDirection: 'highest_wins' });
    },
    extractPlayerStats: function(state, playerId, standing, config, mode) {
      return {
        roundsPlayed: helpers.isQuickState(state) ? 0 : state.rounds.length,
        finalScore: standing.score
      };
    }
  };
};`,
};

function renderHtmlDocumentation(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>StayGames Plugin API Specification</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --accent: #6366f1;
      --accent-light: #818cf8;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --code-bg: #090d16;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      background: #4338ca;
      color: #e0e7ff;
    }
    .public-badge {
      background: #065f46;
      color: #6ee7b7;
    }
    p { margin-bottom: 1rem; color: var(--text-muted); }
    h2 { font-size: 1.4rem; margin: 2rem 0 1rem; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; color: var(--accent-light); }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      background: var(--card-bg);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    th {
      background: #1e293b;
      font-weight: 600;
      color: #e2e8f0;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      background: var(--code-bg);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      color: #cbd5e1;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      overflow-x: auto;
      margin-bottom: 1.5rem;
    }
    pre code {
      background: none;
      padding: 0;
      color: #e2e8f0;
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .method-get { color: #38bdf8; font-weight: bold; }
    .method-post { color: #4ade80; font-weight: bold; }
    .method-delete { color: #f87171; font-weight: bold; }
    .btn-json {
      background: var(--accent);
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-block;
    }
    .btn-json:hover { background: var(--accent-light); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🎮 StayGames Plugin API <span class="badge public-badge">Public Specification</span></h1>
        <p>Specification v1.2: Button Groups, Scoreboard Columns, and Visual Progression Charts</p>
      </div>
      <div>
        <a href="/plugins/api?format=json" class="btn-json">View JSON Format</a>
      </div>
    </header>

    <div class="card">
      <h3 style="margin-top:0;">⚡ Overview</h3>
      <p>StayGames supports hot-pluggable game modules written in JavaScript. Uploaded plugins are persisted in MySQL, compiled in a sandbox, and immediately registered into the live game engine without server restarts.</p>
      <p>Features 1-tap <strong>Radio Button Groups</strong>, automatic <strong>Option Label Resolution</strong> in scoreboards, customizable <strong>Scoreboard Columns</strong>, and <strong>Visual Progression Charts</strong>.</p>
    </div>

    <h2>1. REST Endpoints</h2>
    <table>
      <thead>
        <tr><th>Method</th><th>Path</th><th>Access</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td><span class="method-get">GET</span></td><td><code>/plugins/api</code></td><td><span class="badge public-badge">Public</span></td><td>Returns this full plugin API specification (JSON or HTML)</td></tr>
        <tr><td><span class="method-post">POST</span></td><td><code>/plugins/api/validate</code></td><td><span class="badge public-badge">Public</span></td><td>Dry-run validates plugin code without authentication (ideal for CI and local dev)</td></tr>
        <tr><td><span class="method-get">GET</span></td><td><code>/api/plugins</code></td><td><span class="badge">Authenticated</span></td><td>Lists all installed game plugins</td></tr>
        <tr><td><span class="method-post">POST</span></td><td><code>/api/plugins</code></td><td><span class="badge">Authenticated</span></td><td>Uploads and installs a new plugin (<code>{ codeJs, version, author }</code>)</td></tr>
        <tr><td><span class="method-post">POST</span></td><td><code>/api/plugins/validate</code></td><td><span class="badge">Authenticated</span></td><td>Validates code and returns GameMetadata preview</td></tr>
        <tr><td><span class="method-get">GET</span></td><td><code>/api/plugins/:slug</code></td><td><span class="badge">Authenticated</span></td><td>Retrieves code and metadata for an installed plugin</td></tr>
        <tr><td><span class="method-delete">DELETE</span></td><td><code>/api/plugins/:slug</code></td><td><span class="badge">Authenticated</span></td><td>Uninstalls and unregisters a plugin</td></tr>
      </tbody>
    </table>

    <h2>2. Key Scoreboard & UI Features (v1.2)</h2>
    <div class="card">
      <ul>
        <li><strong>Button Groups / Radio Controls:</strong> Use <code>type: "radio"</code> or <code>display: "buttons"</code> in <code>roundInputFields</code> to render a 1-tap horizontal segmented button bar instead of a dropdown.</li>
        <li><strong>Automatic Option Label Resolution:</strong> Scoreboard tables automatically look up the human-readable <code>label</code> for select/radio values (e.g. <code>"correct_play"</code> renders as <code>"Correct Fireworks Play (+1 pt)"</code>).</li>
        <li><strong>Custom Scoreboard Columns:</strong> Declare <code>scoreboardColumns</code> in your manifest to specify the exact columns, headers, and alignments displayed in the active session's scoreboard.</li>
        <li><strong>Visual Progression Charts:</strong> Declare <code>charts</code> in your manifest to render interactive SVG progression sparklines tracking tokens, hints, and scores over time.</li>
      </ul>
    </div>

    <h2>3. Complete Working Example: Hanabi (v1.2)</h2>
    <p>Demonstrating radio button groups, scoreboard customization, hint and score tracking, and visual charts:</p>
    <pre><code>${escapeHtml(PLUGIN_SPECIFICATION.samplePluginHanabi)}</code></pre>

    <h2>4. Public Sandbox Validation via cURL</h2>
    <pre><code>curl -X POST https://your-staygames-host/plugins/api/validate \\
  -H "Content-Type: application/json" \\
  -d '{ "codeJs": "module.exports = function(helpers) { ... };" }'</code></pre>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Public plugin documentation route: /plugins/api
 * In production, this route is accessible publicly without Authelia proxy authentication.
 */
pluginDocRouter.get('/', (req, res) => {
  const wantsJson =
    req.query.format === 'json' ||
    req.headers.accept?.includes('application/json') ||
    !req.headers.accept?.includes('text/html');

  if (wantsJson) {
    res.json(PLUGIN_SPECIFICATION);
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHtmlDocumentation());
  }
});

/**
 * Public sandbox validation route: POST /plugins/api/validate
 * Accessible without authentication so CI scripts, local tests, and third-party developers
 * can validate plugin code syntax, sandbox execution, and metadata extraction.
 */
pluginDocRouter.post('/validate', (req, res) => {
  try {
    const { codeJs } = req.body ?? {};
    if (!codeJs || typeof codeJs !== 'string') {
      res.status(400).json({ valid: false, error: 'codeJs string is required.' });
      return;
    }
    const def = compilePluginCode(codeJs);
    res.json({
      valid: true,
      game: toGameMetadata(def),
    });
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err?.message || 'Invalid plugin code.' });
  }
});

/**
 * Management API routes: /api/plugins
 */
pluginsRouter.use(requireAuth);

pluginsRouter.get('/', async (_req, res) => {
  try {
    const plugins = await listPlugins();
    res.json({ plugins });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list plugins.' });
  }
});

pluginsRouter.get('/:slug', async (req, res) => {
  try {
    const plugin = await getPluginBySlug(req.params.slug);
    if (!plugin) {
      res.status(404).json({ error: 'Plugin not found.' });
      return;
    }
    res.json({ plugin });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch plugin.' });
  }
});

pluginsRouter.post('/validate', async (req, res) => {
  try {
    const { codeJs } = req.body ?? {};
    if (!codeJs || typeof codeJs !== 'string') {
      res.status(400).json({ valid: false, error: 'codeJs string is required.' });
      return;
    }
    const def = compilePluginCode(codeJs);
    res.json({
      valid: true,
      game: toGameMetadata(def),
    });
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err?.message || 'Invalid plugin code.' });
  }
});

pluginsRouter.post('/', async (req, res) => {
  try {
    const { codeJs, version, author } = req.body ?? {};
    if (!codeJs || typeof codeJs !== 'string') {
      res.status(400).json({ error: 'codeJs is required.' });
      return;
    }

    const result = await installOrUpdatePlugin({
      codeJs,
      version: version ? String(version) : undefined,
      author: author ? String(author) : (req.user?.displayName || undefined),
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to install plugin.' });
  }
});

pluginsRouter.delete('/:slug', async (req, res) => {
  try {
    await uninstallPlugin(req.params.slug);
    res.json({ success: true, message: `Plugin ${req.params.slug} uninstalled.` });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete plugin.' });
  }
});
