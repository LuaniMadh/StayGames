import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { signAuthToken } from '../server/middleware/auth';
import { compilePluginCode } from '../server/services/pluginService';
import {
  createCooperativeStandings,
  getAllGames,
  getGameBySlug,
  rankEntries,
  registerGame,
  unregisterGame,
} from '../shared/games/index';

describe('Plugin Compilation & Sandboxing', () => {
  it('compiles a plugin using helpers.createSimplePointsGame', () => {
    const code = `
      module.exports = function(helpers) {
        return helpers.createSimplePointsGame({
          slug: 'test-points-game',
          name: 'Test Points Game',
          tagline: 'A test points game',
          description: 'Testing simple points game factory',
          minPlayers: 2,
          maxPlayers: 6,
          scoringDirection: 'highest_wins',
          defaultTargetScore: 50,
        });
      };
    `;

    const def = compilePluginCode(code);
    expect(def.slug).toBe('test-points-game');
    expect(def.name).toBe('Test Points Game');
    expect(def.scoringDirection).toBe('highest_wins');
    expect(typeof def.addRound).toBe('function');
    expect(typeof def.computeStandings).toBe('function');

    // Test game lifecycle methods
    const init = def.createInitialState([1, 2], { targetScore: 50 }, 'scorecard');
    expect(init.totals).toEqual({ 1: 0, 2: 0 });

    const round1 = def.addRound(init, { pointsByPlayer: { 1: 30, 2: 15 } }, [1, 2], { targetScore: 50 });
    expect(round1.totals).toEqual({ 1: 30, 2: 15 });
    expect(def.isGameComplete(round1, [1, 2], { targetScore: 50 }, 'scorecard')).toBe(false);

    const round2 = def.addRound(round1, { pointsByPlayer: { 1: 25, 2: 10 } }, [1, 2], { targetScore: 50 });
    expect(round2.totals).toEqual({ 1: 55, 2: 25 });
    expect(def.isGameComplete(round2, [1, 2], { targetScore: 50 }, 'scorecard')).toBe(true);

    const standings = def.computeStandings(round2, [1, 2], { targetScore: 50 }, 'scorecard');
    expect(standings[0]).toMatchObject({ playerId: 1, rank: 1, isWinner: true, score: 55 });
    expect(standings[1]).toMatchObject({ playerId: 2, rank: 2, isWinner: false, score: 25 });
  });

  it('compiles and executes the Hanabi cooperative plugin with radio action buttons, scoreboard columns, and charts', () => {
    const code = `
      module.exports = function(helpers) {
        return {
          slug: 'hanabi',
          name: 'Hanabi',
          tagline: 'Cooperative fireworks card challenge',
          description: 'Players work together to assemble fireworks series.',
          gameType: 'cooperative',
          cooperative: true,
          minPlayers: 2,
          maxPlayers: 5,
          supportedModes: ['scorecard'],
          defaultMode: 'scorecard',
          scoringDirection: 'highest_wins',
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
          scoreboardColumns: [
            { key: 'action', label: 'Turn Action', align: 'left' },
            { key: 'remainingClues', label: 'Remaining Clues', align: 'center', format: 'integer' },
            { key: 'currentErrors', label: 'Current Errors', align: 'center', format: 'integer' },
            { key: 'teamScore', label: 'Fireworks Score', align: 'right', format: 'integer' }
          ],
          charts: [
            { key: 'hintHistory', title: 'Available Hints History', type: 'line', dataKey: 'hintHistory', yAxisMin: 0, yAxisMax: 8 },
            { key: 'scoreHistory', title: 'Fireworks Progress', type: 'line', dataKey: 'scoreHistory', yAxisMin: 0, yAxisMax: 25 }
          ],
          getDefaultConfig: function() { return { targetScore: 25 }; },
          createInitialState: function(playerIds) {
            return {
              teamScore: 0,
              clues: 8,
              strikes: 0,
              hintHistory: [8],
              scoreHistory: [0],
              rounds: []
            };
          },
          addRound: function(state, roundInput) {
            var action = roundInput.action || 'correct_play';
            var ptsAdded = action === 'correct_play' ? 1 : 0;
            var nextScore = Math.min(25, (state.teamScore || 0) + ptsAdded);
            var nextClues = state.clues !== undefined ? state.clues : 8;
            if (action === 'give_clue') nextClues = Math.max(0, nextClues - 1);
            if (action === 'discard') nextClues = Math.min(8, nextClues + 1);
            var nextStrikes = state.strikes + (action === 'strike' ? 1 : 0);
            return {
              teamScore: nextScore,
              clues: nextClues,
              strikes: nextStrikes,
              hintHistory: state.hintHistory.concat([nextClues]),
              scoreHistory: state.scoreHistory.concat([nextScore]),
              rounds: state.rounds.concat([{
                roundNumber: state.rounds.length + 1,
                action: action,
                teamScore: nextScore,
                remainingClues: nextClues,
                currentErrors: nextStrikes,
                input: roundInput
              }])
            };
          },
          undoLastRound: function(state) {
            return state;
          },
          isGameComplete: function(state) {
            return state.strikes >= 3 || state.teamScore >= 25;
          },
          computeStandings: function(state, playerIds) {
            var isLoss = state.strikes >= 3;
            return helpers.createCooperativeStandings(playerIds, state.teamScore, {
              isWin: !isLoss && state.teamScore >= 18,
              secondaryBadge: isLoss ? 'Explosion (3 Strikes) - Defeat' : (state.teamScore + '/25 Fireworks Points')
            });
          },
          extractPlayerStats: function(state, playerId, standing) {
            return { teamScore: state.teamScore, strikes: state.strikes };
          }
        };
      };
    `;

    const def = compilePluginCode(code);
    expect(def.slug).toBe('hanabi');
    expect(def.cooperative).toBe(true);
    expect(def.gameType).toBe('cooperative');
    expect(def.roundInputFields).toHaveLength(1);
    expect(def.roundInputFields![0].type).toBe('radio');
    expect(def.scoreboardColumns).toHaveLength(4);
    expect(def.charts).toHaveLength(2);

    // Initial state: 8 clues, 0 strikes, 0 points
    const s0 = def.createInitialState([10, 20, 30], { targetScore: 25 }, 'scorecard');
    expect(s0.teamScore).toBe(0);
    expect(s0.clues).toBe(8);
    expect(s0.strikes).toBe(0);
    expect(s0.hintHistory).toEqual([8]);
    expect(s0.scoreHistory).toEqual([0]);

    // Round 1: action = correct_play (+1 firework point)
    const s1 = def.addRound(s0, { action: 'correct_play' }, [10, 20, 30], {});
    expect(s1.teamScore).toBe(1);
    expect(s1.clues).toBe(8);
    expect(s1.strikes).toBe(0);
    expect(s1.scoreHistory).toEqual([0, 1]);
    expect(s1.rounds[0].action).toBe('correct_play');
    expect(s1.rounds[0].remainingClues).toBe(8);

    // Round 2: action = give_clue (-1 clue)
    const s2 = def.addRound(s1, { action: 'give_clue' }, [10, 20, 30], {});
    expect(s2.teamScore).toBe(1);
    expect(s2.clues).toBe(7);
    expect(s2.hintHistory).toEqual([8, 8, 7]);

    // Round 3: action = strike (+1 strike)
    const s3 = def.addRound(s2, { action: 'strike' }, [10, 20, 30], {});
    expect(s3.strikes).toBe(1);

    // Round 4: action = discard (+1 clue)
    const s4 = def.addRound(s3, { action: 'discard' }, [10, 20, 30], {});
    expect(s4.clues).toBe(8);
    expect(s4.hintHistory).toEqual([8, 8, 7, 7, 8]);
  });

  it('handles cooperative quick mode results in Hanabi plugin', () => {
    const fs = require('fs');
    const hanabiCode = fs.readFileSync('plugins/hanabi.js', 'utf8');
    const def = compilePluginCode(hanabiCode);

    const quickVictoryState = {
      kind: 'quick',
      placements: [
        { playerId: 1, placement: 1, score: 25 },
        { playerId: 2, placement: 1, score: 25 },
      ],
    };

    const standings = def.computeStandings(quickVictoryState as any, [1, 2], { targetScore: 25 }, 'quick');
    expect(standings).toHaveLength(2);
    expect(standings[0]).toMatchObject({ playerId: 1, rank: 1, isWinner: true, score: 25 });
    expect(standings[1]).toMatchObject({ playerId: 2, rank: 1, isWinner: true, score: 25 });
    expect(standings[0].secondaryBadge).toContain('Legendary');

    const stats1 = def.extractPlayerStats(quickVictoryState as any, 1, standings[0], { targetScore: 25 }, 'quick');
    expect(stats1).toMatchObject({ teamScore: 25, isWin: true, rating: 'Legendary (25)' });
  });

  it('rejects invalid plugins missing required fields or methods', () => {
    // Missing slug
    expect(() => compilePluginCode('module.exports = { name: "No slug" };')).toThrow();

    // Invalid slug with uppercase / special chars
    expect(() =>
      compilePluginCode(`
        module.exports = {
          slug: "Invalid Slug!",
          name: "Test",
          tagline: "t",
          description: "d",
          minPlayers: 1,
          maxPlayers: 2,
          supportedModes: ["scorecard"],
          defaultMode: "scorecard",
          scoringDirection: "highest_wins",
          getDefaultConfig: function() {},
          createInitialState: function() {},
          addRound: function() {},
          undoLastRound: function() {},
          isGameComplete: function() {},
          computeStandings: function() {},
          extractPlayerStats: function() {}
        };
      `)
    ).toThrow(/Invalid plugin slug/);

    // Missing addRound
    expect(() =>
      compilePluginCode(`
        module.exports = {
          slug: "no-add-round",
          name: "Test",
          tagline: "t",
          description: "d",
          minPlayers: 1,
          maxPlayers: 2,
          supportedModes: ["scorecard"],
          defaultMode: "scorecard",
          scoringDirection: "highest_wins",
          getDefaultConfig: function() {},
          createInitialState: function() {},
          undoLastRound: function() {},
          isGameComplete: function() {},
          computeStandings: function() {},
          extractPlayerStats: function() {}
        };
      `)
    ).toThrow(/Plugin missing required function: "addRound\(\)"/);
  });

  it('sandboxes dangerous globals', () => {
    expect(() =>
      compilePluginCode(`
        module.exports = function() {
          const fs = require('fs');
          return {};
        };
      `)
    ).toThrow();
  });
});

describe('Cooperative Standings Helpers', () => {
  it('createCooperativeStandings gives all teammates Rank 1 with shared outcome', () => {
    const standings = createCooperativeStandings([1, 2, 3], 24, {
      isWin: true,
      secondaryBadge: 'Spectacular Show',
    });

    expect(standings).toHaveLength(3);
    for (const s of standings) {
      expect(s.rank).toBe(1);
      expect(s.isWinner).toBe(true);
      expect(s.score).toBe(24);
      expect(s.scoreFormatted).toBe('24 pts');
      expect(s.secondaryBadge).toBe('Spectacular Show');
    }
  });

  it('rankEntries supports declarative options and cooperative mode', () => {
    // Declarative competitive
    const comp = rankEntries(
      [{ playerId: 1, score: 20 }, { playerId: 2, score: 50 }],
      { scoringDirection: 'highest_wins' }
    );
    expect(comp[0]).toMatchObject({ playerId: 2, rank: 1, isWinner: true, score: 50 });
    expect(comp[1]).toMatchObject({ playerId: 1, rank: 2, isWinner: false, score: 20 });

    // Declarative cooperative
    const coop = rankEntries(
      [{ playerId: 1, score: 22 }, { playerId: 2, score: 22 }],
      { cooperative: true }
    );
    expect(coop[0].rank).toBe(1);
    expect(coop[1].rank).toBe(1);
    expect(coop[0].score).toBe(22);
  });
});

describe('Live Game Registry Integration', () => {
  it('registers and unregisters plugin definitions dynamically', () => {
    const code = `
      module.exports = function(helpers) {
        return helpers.createSimplePointsGame({
          slug: 'dynamic-test-game',
          name: 'Dynamic Test Game',
          tagline: 'Dynamic game',
          description: 'Testing live dynamic game registry',
          minPlayers: 2,
          maxPlayers: 4,
          scoringDirection: 'highest_wins'
        });
      };
    `;

    const def = compilePluginCode(code);
    registerGame(def);

    expect(getGameBySlug('dynamic-test-game')).toBeDefined();
    expect(getAllGames().some((g) => g.slug === 'dynamic-test-game')).toBe(true);

    unregisterGame('dynamic-test-game');
    expect(getGameBySlug('dynamic-test-game')).toBeUndefined();
  });
});

describe('Plugin HTTP Endpoints', () => {
  const app = createApp();
  const token = signAuthToken({
    playerId: 1,
    username: 'admin',
    displayName: 'Admin User',
    email: null,
    avatarColor: '#000',
    ldapUid: 'admin',
  });

  it('GET /plugins/api is strictly public and serves JSON with ?format=json', async () => {
    const res = await request(app).get('/plugins/api?format=json');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.2.0');
    expect(res.body.description).toContain('Plugin API');
    expect(Array.isArray(res.body.manifestFields)).toBe(true);
    expect(res.body.manifestFields.some((f: any) => f.name === 'cooperative')).toBe(true);
    expect(res.body.manifestFields.some((f: any) => f.name === 'roundInputFields')).toBe(true);
    expect(res.body.manifestFields.some((f: any) => f.name === 'scoreboardColumns')).toBe(true);
    expect(res.body.manifestFields.some((f: any) => f.name === 'charts')).toBe(true);
    expect(res.body.samplePluginHanabi).toContain('slug: \'hanabi\'');
  });

  it('GET /plugins/api serves HTML documentation including cooperative guidance', async () => {
    const res = await request(app)
      .get('/plugins/api')
      .set('Accept', 'text/html,application/xhtml+xml');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/html');
    expect(res.text).toContain('StayGames Plugin API');
    expect(res.text).toContain('Cooperative');
    expect(res.text).toContain('Hanabi');
  });

  it('POST /plugins/api/validate is PUBLIC (NO AUTH REQUIRED) for CI and local testing', async () => {
    const validCode = `
      module.exports = function(helpers) {
        return helpers.createSimplePointsGame({
          slug: 'unauthed-ci-test',
          name: 'Unauthed CI Test',
          tagline: 'Tagline',
          description: 'Description',
          minPlayers: 2,
          maxPlayers: 5,
          scoringDirection: 'highest_wins'
        });
      };
    `;

    // Notice: NO Authorization header sent!
    const res = await request(app)
      .post('/plugins/api/validate')
      .send({ codeJs: validCode });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.game.slug).toBe('unauthed-ci-test');
  });

  it('POST /plugins/api/validate reports syntax errors without authentication', async () => {
    const invalidCode = 'syntax error {{';

    const res = await request(app)
      .post('/plugins/api/validate')
      .send({ codeJs: invalidCode });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toContain('Plugin syntax/execution error');
  });

  it('protects /api/plugins against unauthenticated requests', async () => {
    const res = await request(app).get('/api/plugins');
    expect(res.status).toBe(401);
  });

  it('allows authenticated dry-run validation via POST /api/plugins/validate', async () => {
    const validCode = `
      module.exports = function(helpers) {
        return helpers.createSimplePointsGame({
          slug: 'valid-test-preview',
          name: 'Valid Test Preview',
          tagline: 'Tagline',
          description: 'Description',
          minPlayers: 2,
          maxPlayers: 5,
          scoringDirection: 'highest_wins'
        });
      };
    `;

    const res = await request(app)
      .post('/api/plugins/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ codeJs: validCode });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.game.slug).toBe('valid-test-preview');
  });
});
