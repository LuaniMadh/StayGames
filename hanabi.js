/**
 * Hanabi Game Plugin for StayGames
 * 
 * Version: 1.1.1
 * Hanabi is a cooperative deduction card game where players work together
 * as a team to assemble 5 fireworks series (numbers 1-5 in each color)
 * before running out of cards or suffering 3 strikes (errors).
 */
module.exports = function(helpers) {
  var ACTION_CONFIG = {
    'correct_play': {
      id: 'correct_play',
      label: 'Correct Fireworks Play',
      scoreDelta: 1,
      clueDelta: 0,
      strikeDelta: 0
    },
    'incorrect_play': {
      id: 'incorrect_play',
      label: 'Incorrect Fireworks Play',
      scoreDelta: 0,
      clueDelta: 0,
      strikeDelta: 1
    },
    'give_clue': {
      id: 'give_clue',
      label: 'Give Clue',
      scoreDelta: 0,
      clueDelta: -1,
      strikeDelta: 0
    },
    'discard': {
      id: 'discard',
      label: 'Discard Card',
      scoreDelta: 0,
      clueDelta: 1,
      strikeDelta: 0
    }
  };

  function resolveAction(actionInput) {
    if (!actionInput) return null;
    if (ACTION_CONFIG[actionInput]) return ACTION_CONFIG[actionInput];

    // Check by user-friendly label
    for (var key in ACTION_CONFIG) {
      if (ACTION_CONFIG[key].label.toLowerCase() === String(actionInput).toLowerCase()) {
        return ACTION_CONFIG[key];
      }
    }
    return null;
  }

  var PLUGIN = {
    slug: 'hanabi',
    name: 'Hanabi',
    tagline: 'Cooperative fireworks card challenge',
    description: 'Players hold their cards facing outward and work together as a team to assemble 5 fireworks series (numbers 1-5 in each color) before running out of cards or suffering 3 strikes.',
    rulesSummary: [
      'Cards are held facing your teammates, never yourself.',
      'Spend Clue Tokens (starts at 8) to give information about colors or numbers.',
      'Discarding a card recovers 1 Clue Token (max 8).',
      'Playing an invalid card triggers a fuse strike / error (3 strikes = explosion and team defeat).',
      'The game ends on 3 strikes, reaching 25 fireworks points, or after the deck runs out.'
    ],
    gameType: 'cooperative',
    cooperative: true,
    minPlayers: 2,
    maxPlayers: 5,
    supportedModes: ['scorecard', 'quick'],
    defaultMode: 'scorecard',
    scoringDirection: 'highest_wins',
    themeColor: 'cyan',
    iconName: 'flame',

    configFields: [
      {
        key: 'targetScore',
        label: 'Victory Goal (Score)',
        type: 'number',
        min: 10,
        max: 30,
        default: 25,
        description: '25 points represents a legendary perfect fireworks show (30 for 6-suit variant)'
      },
      {
        key: 'maxStrikes',
        label: 'Max Strikes (Errors) Before Explosion',
        type: 'number',
        min: 1,
        max: 5,
        default: 3,
        description: 'Number of errors that trigger an explosion'
      },
      {
        key: 'initialClues',
        label: 'Starting Clue Tokens',
        type: 'number',
        min: 1,
        max: 12,
        default: 8,
        description: 'Initial number of available clue (hint) tokens'
      }
    ],

    roundInputFields: [
      {
        key: 'action',
        label: 'Turn Action',
        type: 'radio',
        widget: 'radio',
        display: 'buttons',
        options: [
          { value: 'correct_play', label: 'Correct Fireworks Play' },
          { value: 'incorrect_play', label: 'Incorrect Fireworks Play' },
          { value: 'give_clue', label: 'Give Clue' },
          { value: 'discard', label: 'Discard Card' }
        ],
        default: 'correct_play',
        description: 'Choose the turn action taken by the player'
      }
    ],

    leaderboardColumns: [
      {
        key: 'bestScore',
        label: 'Best Score',
        format: 'integer',
        aggregate: 'max',
        statKey: 'teamScore',
        tooltip: 'Highest fireworks score achieved'
      },
      {
        key: 'strikes',
        label: 'Total Errors',
        format: 'integer',
        aggregate: 'sum',
        statKey: 'strikes',
        tooltip: 'Total fuse strikes/errors accumulated'
      },
      {
        key: 'cluesRemaining',
        label: 'Clues Left',
        format: 'integer',
        aggregate: 'sum',
        statKey: 'cluesRemaining',
        tooltip: 'Clue tokens remaining at end of game'
      },
      {
        key: 'rounds',
        label: 'Rounds Played',
        format: 'integer',
        aggregate: 'sum',
        statKey: 'roundsPlayed',
        tooltip: 'Total rounds played in session'
      }
    ],

    getDefaultConfig: function(playerCount) {
      return {
        targetScore: 25,
        maxStrikes: 3,
        initialClues: 8
      };
    },

    validateConfig: function(config) {
      if (!config) return;
      if (typeof config.targetScore === 'number' && (config.targetScore < 1 || config.targetScore > 35)) {
        throw new Error('Target score must be between 1 and 35');
      }
      if (typeof config.maxStrikes === 'number' && (config.maxStrikes < 1 || config.maxStrikes > 10)) {
        throw new Error('Max strikes must be between 1 and 10');
      }
      if (typeof config.initialClues === 'number' && (config.initialClues < 1 || config.initialClues > 20)) {
        throw new Error('Initial clues must be between 1 and 20');
      }
    },

    getSessionTitle: function(config) {
      var target = (config && config.targetScore) || 25;
      return 'Hanabi (' + target + ' pts)';
    },

    createInitialState: function(playerIds, config, mode) {
      if (mode === 'quick' && helpers && helpers.createEmptyQuickState) {
        return helpers.createEmptyQuickState(playerIds);
      }
      var target = (config && config.targetScore) || 25;
      var maxStrikes = (config && config.maxStrikes) || 3;
      var initialClues = (config && config.initialClues) || 8;

      var totals = {};
      for (var i = 0; i < playerIds.length; i++) {
        totals[playerIds[i]] = 0;
      }

      return {
        kind: 'hanabi',
        teamScore: 0,
        totals: totals,
        clues: initialClues,
        remainingClues: initialClues,
        maxClues: initialClues,
        hints: initialClues,
        remainingHints: initialClues,
        strikes: 0,
        currentErrors: 0,
        errors: 0,
        maxStrikes: maxStrikes,
        targetScore: target,
        isExploded: false,
        hintHistory: [initialClues],
        clueHistory: [initialClues],
        rounds: []
      };
    },

    addRound: function(state, roundInput, playerIds, config) {
      var input = roundInput || {};
      var maxStrikes = (config && config.maxStrikes) || state.maxStrikes || 3;
      var maxClues = (config && config.initialClues) || state.maxClues || 8;
      var targetScore = (config && config.targetScore) || state.targetScore || 25;

      var matchedAction = resolveAction(input.action);

      var scoreDelta = 0;
      var clueDelta = 0;
      var strikeDelta = 0;
      var actionUserLabel = 'Round ' + ((state.rounds ? state.rounds.length : 0) + 1);
      var actionId = 'custom';

      if (matchedAction) {
        actionId = matchedAction.id;
        actionUserLabel = matchedAction.label;
        scoreDelta = matchedAction.scoreDelta;
        clueDelta = matchedAction.clueDelta;
        strikeDelta = matchedAction.strikeDelta;
      } else {
        // Fallback for legacy / direct input formats
        if (typeof input.cardsPlayed === 'number') {
          scoreDelta = input.cardsPlayed;
          actionUserLabel = scoreDelta > 0 ? 'Correct Fireworks Play (+' + scoreDelta + ')' : 'No Fireworks Added';
        } else if (typeof input.teamScore === 'number') {
          scoreDelta = input.teamScore - (state.teamScore || 0);
          actionUserLabel = 'Score Update (' + input.teamScore + ' pts)';
        } else if (input.pointsByPlayer) {
          var sum = 0;
          for (var p = 0; p < playerIds.length; p++) {
            sum += Number(input.pointsByPlayer[playerIds[p]] || 0);
          }
          scoreDelta = sum;
          actionUserLabel = 'Cards Played (+' + sum + ')';
        }

        if (input.clueAction === 'give_clue') {
          clueDelta -= 1;
          actionUserLabel = 'Give Clue';
        } else if (input.clueAction === 'discard') {
          clueDelta += 1;
          actionUserLabel = 'Discard Card';
        }

        if (input.strike || input.isStrike || input.misplay) {
          strikeDelta += 1;
          actionUserLabel = 'Incorrect Fireworks Play';
        }
      }

      // 1. Calculate Next Fireworks Score
      var nextScore = Math.min(targetScore, Math.max(0, (state.teamScore || 0) + scoreDelta));

      // 2. Calculate Next Clue / Hint Count
      var currentClues = state.clues !== undefined ? state.clues : maxClues;
      var nextClues = Math.min(maxClues, Math.max(0, currentClues + clueDelta));

      // 3. Calculate Next Errors / Strikes Count
      var currentStrikes = state.strikes || 0;
      var nextStrikes = currentStrikes + strikeDelta;
      var isExploded = nextStrikes >= maxStrikes;

      // Keep totals synchronized for all players in cooperative mode
      var nextTotals = {};
      var displayedScore = isExploded ? 0 : nextScore;
      for (var k = 0; k < playerIds.length; k++) {
        nextTotals[playerIds[k]] = displayedScore;
      }

      // Track hint history over time for graphs and visualizations
      var prevHintHistory = state.hintHistory || state.clueHistory || [maxClues];
      var nextHintHistory = prevHintHistory.concat([nextClues]);

      // Scoreboard-friendly round entry with user-friendly text labels & explicit columns
      var roundEntry = {
        roundNumber: (state.rounds ? state.rounds.length : 0) + 1,
        // User-friendly action display (replaces raw internal IDs like "correct_play")
        action: actionUserLabel,
        actionLabel: actionUserLabel,
        actionId: actionId,
        // Remaining clues / hints (explicitly named for scoreboard display)
        remainingClues: nextClues,
        cluesRemaining: nextClues,
        remainingHints: nextClues,
        availableHints: nextClues,
        clues: nextClues,
        hints: nextClues,
        // Current errors / strikes (explicitly named for scoreboard display)
        currentErrors: nextStrikes,
        errors: nextStrikes,
        strikes: nextStrikes,
        failures: nextStrikes,
        // Team score progress
        teamScore: nextScore,
        score: displayedScore,
        fireworksScore: nextScore,
        cardsPlayed: scoreDelta,
        input: input
      };

      return {
        kind: 'hanabi',
        teamScore: nextScore,
        totals: nextTotals,
        clues: nextClues,
        remainingClues: nextClues,
        hints: nextClues,
        remainingHints: nextClues,
        maxClues: maxClues,
        strikes: nextStrikes,
        currentErrors: nextStrikes,
        errors: nextStrikes,
        maxStrikes: maxStrikes,
        targetScore: targetScore,
        isExploded: isExploded,
        hintHistory: nextHintHistory,
        clueHistory: nextHintHistory,
        rounds: (state.rounds || []).concat([roundEntry])
      };
    },

    undoLastRound: function(state, playerIds, config) {
      if (!state.rounds || state.rounds.length === 0) return state;
      var roundsToReplay = state.rounds.slice(0, -1);
      var currentState = PLUGIN.createInitialState(playerIds, config, 'scorecard');
      for (var i = 0; i < roundsToReplay.length; i++) {
        currentState = PLUGIN.addRound(currentState, roundsToReplay[i].input, playerIds, config);
      }
      return currentState;
    },

    editRound: function(state, roundNumber, roundInput, playerIds, config) {
      if (!state.rounds || roundNumber < 1 || roundNumber > state.rounds.length) return state;
      var targetIdx = roundNumber - 1;
      var currentState = PLUGIN.createInitialState(playerIds, config, 'scorecard');
      for (var i = 0; i < state.rounds.length; i++) {
        var inputToUse = (i === targetIdx) ? roundInput : state.rounds[i].input;
        currentState = PLUGIN.addRound(currentState, inputToUse, playerIds, config);
      }
      return currentState;
    },

    isGameComplete: function(state, playerIds, config, mode) {
      if (helpers && helpers.isQuickState && helpers.isQuickState(state)) return true;
      var maxStrikes = (config && config.maxStrikes) || state.maxStrikes || 3;
      if ((state.strikes || 0) >= maxStrikes) return true;
      var target = (config && config.targetScore) || state.targetScore || 25;
      if ((state.teamScore || 0) >= target) return true;
      return false;
    },

    computeStandings: function(state, playerIds, config, mode) {
      if (helpers && helpers.isQuickState && helpers.isQuickState(state)) {
        return helpers.computeQuickStandings(state, playerIds);
      }

      var maxStrikes = (config && config.maxStrikes) || state.maxStrikes || 3;
      var isBomb = (state.strikes || 0) >= maxStrikes;
      var finalScore = isBomb ? 0 : (state.teamScore || 0);
      var victoryTarget = (config && config.targetScore) || 25;
      var isWin = !isBomb && (finalScore >= 18);

      var badge = isBomb
        ? 'Explosion (' + state.strikes + ' Errors) - Defeat'
        : finalScore >= victoryTarget
        ? 'Legendary! (' + finalScore + '/' + victoryTarget + ' pts)'
        : (finalScore + '/' + victoryTarget + ' Fireworks Points');

      if (helpers && helpers.createCooperativeStandings) {
        return helpers.createCooperativeStandings(playerIds, finalScore, {
          isWin: isWin,
          secondaryBadge: badge,
          scoreFormatted: finalScore + ' pts'
        });
      }

      var entries = playerIds.map(function(pid) {
        return { playerId: pid, score: finalScore };
      });
      if (helpers && helpers.rankEntries) {
        return helpers.rankEntries(entries, {
          scoringDirection: 'highest_wins',
          cooperative: true
        });
      }

      return playerIds.map(function(pid) {
        return {
          playerId: pid,
          rank: 1,
          score: finalScore,
          isWinner: isWin,
          scoreFormatted: finalScore + ' pts',
          secondaryBadge: badge
        };
      });
    },

    extractPlayerStats: function(state, playerId, standing, config, mode) {
      var isQuick = helpers && helpers.isQuickState && helpers.isQuickState(state);
      var maxStrikes = (config && config.maxStrikes) || state.maxStrikes || 3;
      var isExploded = (state.strikes || 0) >= maxStrikes;
      var score = standing ? standing.score : (isExploded ? 0 : (state.teamScore || 0));

      var rating = 'Horrible (0-5)';
      if (isExploded) {
        rating = 'Exploded (Defeat)';
      } else if (score >= 25) {
        rating = 'Legendary (25)';
      } else if (score >= 21) {
        rating = 'Amazing (21-24)';
      } else if (score >= 16) {
        rating = 'Excellent (16-20)';
      } else if (score >= 11) {
        rating = 'Honorable (11-15)';
      } else if (score >= 6) {
        rating = 'Poor (6-10)';
      }

      var hintsHistory = state.hintHistory || state.clueHistory || [state.clues || 8];

      return {
        teamScore: score,
        strikes: state.strikes || 0,
        currentErrors: state.strikes || 0,
        cluesRemaining: state.clues !== undefined ? state.clues : 8,
        remainingHints: state.clues !== undefined ? state.clues : 8,
        roundsPlayed: isQuick ? 0 : (state.rounds ? state.rounds.length : 0),
        finalScore: score,
        rating: rating,
        isWin: standing ? Boolean(standing.isWinner) : (!isExploded && score >= 18),
        hintHistory: hintsHistory
      };
    }
  };

  return PLUGIN;
};
