import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Code2,
  ExternalLink,
  FileCode,
  Plus,
  Puzzle,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { GameMetadata, PluginRecord } from '../../../shared/types';
import { api } from '../api/client';
import { GameBadge } from '../components/GameIcon';
import { useGames } from '../context/GamesContext';

const SAMPLE_HANABI = `module.exports = function(helpers) {
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
      var nextScore = Math.min(25, (state.teamScore || 0) + ptsAdded));
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
};`;;

const SAMPLE_SIMPLE_POINTS = `module.exports = function(helpers) {
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
      'Each player has 12 cards in a 3x4 grid, mostly face down.',
      'Swap, reveal, and clear columns of identical cards.',
      'A round ends when one player reveals all their cards.',
      'The game ends once any player reaches 100 points.'
    ]
  });
};`;

const SAMPLE_CUSTOM_GAME = `module.exports = function(helpers) {
  return {
    slug: 'coin-toss',
    name: 'Coin Toss Challenge',
    tagline: 'Fast-paced prediction points game',
    description: 'Players guess heads or tails each round. Each correct guess scores 1 point.',
    rulesSummary: [
      'Each round, players score 1 point if they guessed correctly.',
      'First player to reach the winning score wins.'
    ],
    minPlayers: 2,
    maxPlayers: 8,
    supportedModes: ['scorecard', 'quick'],
    defaultMode: 'scorecard',
    scoringDirection: 'highest_wins',
    themeColor: 'amber',
    iconName: 'dice',
    configFields: [
      { key: 'targetScore', label: 'Winning Score', type: 'number', min: 1, max: 20 }
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
};`;

export function PluginsPage() {
  const { games, bySlug, refreshGames } = useGames();
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Upload state
  const [codeJs, setCodeJs] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const [validationPreview, setValidationPreview] = useState<GameMetadata | null>(null);
  const [inspectingPlugin, setInspectingPlugin] = useState<PluginRecord | null>(null);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const res = await api.listPlugins();
      setPlugins(res.plugins);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch plugins.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  const handleValidate = async () => {
    if (!codeJs.trim()) {
      setError('Please provide JavaScript plugin code.');
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await api.validatePlugin(codeJs);
      if (res.valid && res.game) {
        setValidationPreview(res.game);
        setSuccess(`Plugin code is valid! Compiles "${res.game.name}" (${res.game.slug}).`);
      } else {
        setError(res.error || 'Plugin validation failed.');
      }
    } catch (err: any) {
      setError(err?.message || 'Plugin validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleInstall = async () => {
    if (!codeJs.trim()) {
      setError('Please provide JavaScript plugin code.');
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const res = await api.installPlugin({
        codeJs,
        version: version.trim() || '1.0.0',
        author: author.trim() || undefined,
      });
      setSuccess(`Game plugin "${res.game.name}" successfully installed and activated!`);
      setCodeJs('');
      setValidationPreview(null);
      await loadPlugins();
      await refreshGames();
    } catch (err: any) {
      setError(err?.message || 'Failed to install plugin.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (slug: string, name: string) => {
    if (!confirm(`Are you sure you want to uninstall "${name}"? Existing game history will remain safely in the database.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await api.deletePlugin(slug);
      setSuccess(`Plugin "${name}" uninstalled.`);
      await loadPlugins();
      await refreshGames();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete plugin.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCodeJs(content);
        setValidationPreview(null);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black md:text-3xl">Game Plugins</h1>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
              Hot-Pluggable
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Extend StayGames with custom scoring logic and game modules while the server runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/plugins/api"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex items-center gap-2"
          >
            <BookOpen size={16} /> Plugin API Docs <ExternalLink size={14} className="opacity-60" />
          </a>
          <button
            onClick={() => {
              loadPlugins();
              refreshGames();
            }}
            className="btn-secondary flex items-center gap-2"
            title="Refresh plugins list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/15 p-4 text-sm text-rose-200">
          <AlertCircle size={20} className="shrink-0 text-rose-400" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-4 text-sm text-emerald-200">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          <div className="flex-1 font-medium">{success}</div>
        </div>
      )}

      {/* Upload & Install Box */}
      <div className="card space-y-5 border-indigo-500/30 bg-slate-900/70 p-5 shadow-xl md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <UploadCloud size={20} className="text-indigo-400" /> Upload / Install Game Plugin
            </h2>
            <p className="text-xs text-slate-400">
              Provide CommonJS JavaScript exporting your <code>GameDefinition</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Load sample:</span>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1 text-xs border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
              onClick={() => {
                setCodeJs(SAMPLE_HANABI);
                setVersion('1.0.0');
                setAuthor('StayGames Community');
                setValidationPreview(null);
              }}
            >
              🎆 Hanabi (Cooperative)
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1 text-xs"
              onClick={() => {
                setCodeJs(SAMPLE_SIMPLE_POINTS);
                setVersion('1.0.0');
                setAuthor('StayGames Community');
                setValidationPreview(null);
              }}
            >
              Skyjo (Simple Points)
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1 text-xs"
              onClick={() => {
                setCodeJs(SAMPLE_CUSTOM_GAME);
                setVersion('1.0.0');
                setAuthor('StayGames Community');
                setValidationPreview(null);
              }}
            >
              Coin Toss (Custom State)
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Version
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Author
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name or team"
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              JavaScript Source Code (.js)
            </label>
            <label className="btn-secondary cursor-pointer px-2.5 py-1 text-xs flex items-center gap-1.5">
              <FileCode size={14} /> Browse .js file
              <input
                type="file"
                accept=".js,.cjs,.mjs"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          <textarea
            value={codeJs}
            onChange={(e) => {
              setCodeJs(e.target.value);
              setValidationPreview(null);
            }}
            placeholder={`module.exports = function(helpers) {\n  return helpers.createSimplePointsGame({\n    slug: 'my-game',\n    name: 'My Custom Game',\n    ...\n  });\n};`}
            rows={12}
            className="input w-full font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Validation Preview Card */}
        {validationPreview && (
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">
              <Sparkles size={14} /> Plugin Validation Preview
            </div>
            <div className="flex items-center gap-3">
              <GameBadge game={validationPreview} />
              <div>
                <div className="font-bold text-white">{validationPreview.name}</div>
                <div className="text-xs text-slate-400">{validationPreview.description}</div>
                <div className="mt-1 text-xs text-slate-500">
                  Slug: <code>{validationPreview.slug}</code> | Players: {validationPreview.minPlayers}-{validationPreview.maxPlayers} | Direction: {validationPreview.scoringDirection}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleValidate}
            disabled={busy || !codeJs.trim()}
          >
            <Code2 size={16} /> Validate Code
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleInstall}
            disabled={busy || !codeJs.trim()}
          >
            <Plus size={16} /> Install & Activate
          </button>
        </div>
      </div>

      {/* Installed Custom Plugins List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Puzzle size={20} className="text-indigo-400" /> Installed Custom Plugins ({plugins.length})
        </h2>

        {plugins.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            No custom plugins installed yet. Upload one above or click a sample template to get started!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {plugins.map((plugin) => (
              <div
                key={plugin.slug}
                className="card flex flex-col justify-between border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-white flex items-center gap-2">
                        {plugin.name}
                        {bySlug[plugin.slug]?.cooperative && (
                          <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                            Cooperative
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-400">slug: {plugin.slug}</div>
                    </div>
                    <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                      v{plugin.version}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-300 line-clamp-2">
                    {plugin.description || 'No description provided.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    {plugin.author && <span>By {plugin.author}</span>}
                    <span>Added {new Date(plugin.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <button
                    className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1.5"
                    onClick={() => setInspectingPlugin(plugin)}
                  >
                    <Code2 size={13} /> View Code
                  </button>
                  <button
                    className="btn-secondary px-2.5 py-1 text-xs text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 flex items-center gap-1.5"
                    onClick={() => handleDelete(plugin.slug, plugin.name)}
                  >
                    <Trash2 size={13} /> Uninstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built-in Core Games Showcase */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100">Built-in Core Games</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games
            .filter((g) => ['wizard', 'phase-10', 'uno', 'thats-not-a-hat', 'misc'].includes(g.slug))
            .map((game) => (
              <div
                key={game.slug}
                className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/30 p-3.5"
              >
                <GameBadge game={game} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-200">{game.name}</div>
                  <div className="truncate text-xs text-slate-500">{game.tagline}</div>
                </div>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  Built-in
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Code Inspection Modal */}
      {inspectingPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-3xl space-y-4 border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {inspectingPlugin.name} <span className="text-sm font-mono text-slate-400">({inspectingPlugin.slug})</span>
                </h3>
                <p className="text-xs text-slate-400">Version {inspectingPlugin.version}</p>
              </div>
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => setInspectingPlugin(null)}
              >
                Close
              </button>
            </div>

            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300">
              <code>{inspectingPlugin.codeJs}</code>
            </pre>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(inspectingPlugin.codeJs);
                  alert('Code copied to clipboard!');
                }}
              >
                Copy Code
              </button>
              <button
                className="btn-primary text-xs"
                onClick={() => setInspectingPlugin(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
