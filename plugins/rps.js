module.exports = function(helpers) {
  return {
    slug: 'rps',
    name: 'Rock Paper Scissors',
    tagline: 'Classic hand game: Rock crushes Scissors, Scissors cuts Paper, Paper covers Rock!',
    description: 'Rock Paper Scissors is a simultaneous hand game where players throw Rock, Paper, or Scissors. Win rounds by beating your opponent’s throw until reaching the target score!',
    rulesSummary: [
      'Two or more players simultaneously reveal Rock, Paper, or Scissors.',
      'Rock beats Scissors (crushes).',
      'Scissors beats Paper (cuts).',
      'Paper beats Rock (covers).',
      'Identical throws result in a tie (no points awarded).',
      'The first player to reach the winning score wins the match!'
    ],
    gameType: 'competitive',
    cooperative: false,
    minPlayers: 2,
    maxPlayers: 8,
    supportedModes: ['scorecard', 'quick'],
    defaultMode: 'scorecard',
    scoringDirection: 'highest_wins',
    themeColor: 'amber',
    iconName: 'dice',

    configFields: [
      {
        key: 'targetScore',
        label: 'Winning Score (First to X wins)',
        type: 'number',
        min: 1,
        max: 50,
        default: 3,
        description: 'First player to reach this number of round wins takes the match'
      }
    ],

    roundInputFields: [
      {
        key: 'outcome',
        label: 'Round Result',
        type: 'radio',
        display: 'buttons',
        options: [
          { value: 'win', label: 'Decisive Win' },
          { value: 'tie', label: 'Draw / Tie (No Points)' }
        ],
        default: 'win',
        description: 'Whether this round had a decisive winner or ended in a draw'
      }
    ],

    scoreboardColumns: [
      { key: 'roundNumber', label: 'Round', align: 'center', format: 'integer' },
      { key: 'outcome', label: 'Result', align: 'center', format: 'badge' }
    ],

    charts: [
      {
        key: 'scoreHistory',
        title: 'Score Progression',
        type: 'line',
        dataKey: 'scoreHistory',
        color: '#f59e0b'
      }
    ],

    leaderboardColumns: [
      {
        key: 'roundsWon',
        label: 'Rounds Won',
        format: 'integer',
        aggregate: 'sum',
        statKey: 'roundsWon',
        tooltip: 'Total rounds won across sessions'
      },
      {
        key: 'winRate',
        label: 'Win Rate',
        format: 'percent',
        aggregate: 'ratio_percent',
        statKey: 'roundsWon',
        denominatorStatKey: 'roundsPlayed',
        tooltip: 'Percentage of played rounds won'
      },
      {
        key: 'roundsPlayed',
        label: 'Rounds Played',
        format: 'integer',
        aggregate: 'sum',
        statKey: 'roundsPlayed',
        tooltip: 'Total rounds participated in'
      }
    ],

    getDefaultConfig: function(playerCount) {
      return {
        targetScore: 3
      };
    },

    validateConfig: function(config) {
      if (!config) return;
      var target = config.targetScore;
      if (typeof target === 'number' && (target < 1 || target > 100)) {
        throw new Error('Winning score must be between 1 and 100');
      }
    },

    getSessionTitle: function(config) {
      var target = (config && config.targetScore) || 3;
      return 'Rock Paper Scissors (First to ' + target + ')';
    },

    createInitialState: function(playerIds, config, mode) {
      if (mode === 'quick' && helpers && helpers.createEmptyQuickState) {
        return helpers.createEmptyQuickState(playerIds);
      }
      var target = (config && config.targetScore) || 3;
      var totals = {};
      for (var i = 0; i < playerIds.length; i++) {
        totals[playerIds[i]] = 0;
      }
      return {
        kind: 'simple-points',
        totals: totals,
        targetScore: target,
        rounds: []
      };
    },

    addRound: function(state, roundInput, playerIds, config) {
      var points = (roundInput && roundInput.pointsByPlayer) || {};
      var nextTotals = Object.assign({}, state.totals);

      for (var i = 0; i < playerIds.length; i++) {
        var pid = playerIds[i];
        var pts = Number(points[pid] || 0);
        nextTotals[pid] = (nextTotals[pid] || 0) + pts;
      }

      var roundOutcome = (roundInput && roundInput.outcome) || 'win';
      if (roundOutcome === 'tie') {
        roundOutcome = 'Draw / Tie';
      } else if (roundOutcome === 'win') {
        roundOutcome = 'Decisive Win';
      }

      var roundEntry = {
        roundNumber: (state.rounds ? state.rounds.length : 0) + 1,
        points: points,
        outcome: roundOutcome,
        input: roundInput
      };

      return {
        kind: 'simple-points',
        totals: nextTotals,
        targetScore: state.targetScore || (config && config.targetScore) || 3,
        rounds: (state.rounds || []).concat([roundEntry])
      };
    },

    undoLastRound: function(state, playerIds, config) {
      if (!state.rounds || state.rounds.length === 0) return state;
      var last = state.rounds[state.rounds.length - 1];
      var nextTotals = Object.assign({}, state.totals);
      var points = last.points || {};

      for (var i = 0; i < playerIds.length; i++) {
        var pid = playerIds[i];
        nextTotals[pid] = (nextTotals[pid] || 0) - Number(points[pid] || 0);
      }

      return {
        kind: 'simple-points',
        totals: nextTotals,
        targetScore: state.targetScore || (config && config.targetScore) || 3,
        rounds: state.rounds.slice(0, -1)
      };
    },

    editRound: function(state, roundNumber, roundInput, playerIds, config) {
      if (!state.rounds || roundNumber < 1 || roundNumber > state.rounds.length) return state;
      var targetIdx = roundNumber - 1;
      var totals = {};
      for (var p = 0; p < playerIds.length; p++) totals[playerIds[p]] = 0;
      var nextRounds = [];

      for (var i = 0; i < state.rounds.length; i++) {
        var input = (i === targetIdx) ? roundInput : state.rounds[i].input;
        var pts = (input && input.pointsByPlayer) || {};
        for (var j = 0; j < playerIds.length; j++) {
          var id = playerIds[j];
          totals[id] = (totals[id] || 0) + Number(pts[id] || 0);
        }
        var outcome = (input && input.outcome) || 'win';
        if (outcome === 'tie') outcome = 'Draw / Tie';
        else if (outcome === 'win') outcome = 'Decisive Win';

        nextRounds.push({
          roundNumber: i + 1,
          points: pts,
          outcome: outcome,
          input: input
        });
      }

      return {
        kind: 'simple-points',
        totals: totals,
        targetScore: state.targetScore,
        rounds: nextRounds
      };
    },

    isGameComplete: function(state, playerIds, config, mode) {
      if (helpers && helpers.isQuickState && helpers.isQuickState(state)) return true;
      var target = (config && config.targetScore) || state.targetScore || 3;
      for (var i = 0; i < playerIds.length; i++) {
        if ((state.totals[playerIds[i]] || 0) >= target) return true;
      }
      return false;
    },

    computeStandings: function(state, playerIds, config, mode) {
      if (helpers && helpers.isQuickState && helpers.isQuickState(state)) {
        return helpers.computeQuickStandings(state, playerIds);
      }
      var target = (config && config.targetScore) || state.targetScore || 3;
      var entries = playerIds.map(function(pid) {
        return {
          playerId: pid,
          score: state.totals[pid] || 0
        };
      });

      if (helpers && helpers.rankEntries) {
        return helpers.rankEntries(entries, {
          scoringDirection: 'highest_wins',
          unitLabel: 'pts',
          isWinner: function(item, rank) {
            return rank === 1 && (item.score || 0) >= target;
          }
        });
      }

      entries.sort(function(a, b) {
        return b.score - a.score;
      });
      return entries.map(function(e, idx) {
        return {
          playerId: e.playerId,
          rank: idx + 1,
          score: e.score,
          scoreFormatted: e.score + ' pts',
          isWinner: idx === 0 && e.score >= target
        };
      });
    },

    extractPlayerStats: function(state, playerId, standing, config, mode) {
      var isQuick = helpers && helpers.isQuickState && helpers.isQuickState(state);
      var roundsCount = isQuick ? 0 : (state.rounds ? state.rounds.length : 0);
      var won = isQuick ? (standing.rank === 1 ? 1 : 0) : (state.totals ? (state.totals[playerId] || 0) : 0);

      return {
        roundsWon: won,
        roundsPlayed: roundsCount,
        finalScore: standing ? standing.score : (state.totals ? state.totals[playerId] || 0 : 0)
      };
    }
  };
};
