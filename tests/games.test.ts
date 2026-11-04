import { describe, expect, it } from 'vitest';
import {
  calculateWizardDelta,
  wizardGame,
  type WizardState,
} from '../shared/games/wizard';
import { phase10Game, type Phase10State } from '../shared/games/phase10';
import { unoGame, type UnoState } from '../shared/games/uno';
import { thatsNotAHatGame, type ThatsNotAHatState } from '../shared/games/thatsNotAHat';
import { createSimplePointsGame } from '../shared/games/simplePoints';
import { getAllGames, getGameBySlug } from '../shared/games/index';
import type { QuickModeState } from '../shared/types';

const P = [1, 2, 3];

describe('game registry', () => {
  it('registers the built-in games and catch-all misc module', () => {
    expect(getAllGames().map((g) => g.slug)).toEqual([
      'wizard',
      'phase-10',
      'uno',
      'thats-not-a-hat',
      'misc',
    ]);
    expect(getGameBySlug('uno')?.name).toBe('Uno');
    expect(getGameBySlug('misc')?.name).toBe('Other game');
  });
});

describe('Wizard', () => {
  const cfg = wizardGame.getDefaultConfig(3);

  it('default rounds = 60 / players', () => {
    expect(cfg.maxRounds).toBe(20);
    expect(wizardGame.getDefaultConfig(4).maxRounds).toBe(15);
    expect(wizardGame.getDefaultConfig(6).maxRounds).toBe(10);
  });

  it('scores exact and missed bids', () => {
    expect(calculateWizardDelta(0, 0)).toBe(20);
    expect(calculateWizardDelta(2, 2)).toBe(40);
    expect(calculateWizardDelta(1, 3)).toBe(-20);
  });

  it('plays rounds, validates trick totals, undoes and ranks', () => {
    let s = wizardGame.createInitialState(P, cfg, 'scorecard') as WizardState;
    // Round 1: 1 card
    s = wizardGame.addRound(s, { bids: { 1: 1, 2: 0, 3: 1 }, tricks: { 1: 1, 2: 0, 3: 0 } }, P, cfg);
    expect(s.rounds[0].entries.map((e) => e.cumulativeScore)).toEqual([30, 20, -10]);

    // Round 2: wrong trick total
    expect(() =>
      wizardGame.addRound(s, { bids: { 1: 0, 2: 0, 3: 0 }, tricks: { 1: 1, 2: 0, 3: 0 } }, P, cfg)
    ).toThrow(/must equal cards dealt/);

    s = wizardGame.addRound(s, { bids: { 1: 2, 2: 0, 3: 1 }, tricks: { 1: 1, 2: 0, 3: 1 } }, P, cfg);
    expect(s.rounds[1].entries.map((e) => e.cumulativeScore)).toEqual([20, 40, 20]);

    const standings = wizardGame.computeStandings(s, P, cfg, 'scorecard');
    expect(standings[0]).toMatchObject({ playerId: 2, rank: 1, isWinner: true, score: 40 });
    expect(standings[1].rank).toBe(2);
    expect(standings[2].rank).toBe(2); // tie at 20, same exact bids count

    s = wizardGame.undoLastRound(s, P, cfg);
    expect(s.rounds).toHaveLength(1);
    expect(s.pendingBids).toEqual({ 1: 2, 2: 0, 3: 1 });
  });

  it('enforces the ±1 forbidden total bid rule', () => {
    const strict = { ...cfg, forbidExactTotalBid: true };
    const s = wizardGame.createInitialState(P, strict, 'scorecard') as WizardState;
    expect(() => wizardGame.addRound(s, { type: 'save_bids', bids: { 1: 1, 2: 0, 3: 0 } }, P, strict)).toThrow(/Plus\/Minus/);
  });

  it('completes after maxRounds and extracts bid stats', () => {
    const short = { maxRounds: 1, forbidExactTotalBid: false };
    let s = wizardGame.createInitialState(P, short, 'scorecard') as WizardState;
    s = wizardGame.addRound(s, { bids: { 1: 0, 2: 0, 3: 1 }, tricks: { 1: 0, 2: 0, 3: 1 } }, P, short);
    expect(wizardGame.isGameComplete(s, P, short, 'scorecard')).toBe(true);
    const st = wizardGame.computeStandings(s, P, short, 'scorecard');
    const stats = wizardGame.extractPlayerStats(s, 1, st.find((x) => x.playerId === 1)!, short, 'scorecard');
    expect(stats).toMatchObject({ exactBids: 1, roundsPlayed: 1, zeroBidsHit: 1 });
  });
});

describe('Phase 10', () => {
  const cfg = phase10Game.getDefaultConfig(3);

  it('advances phases sequentially and breaks ties by lowest points', () => {
    let s = phase10Game.createInitialState(P, cfg, 'scorecard') as Phase10State;
    s = phase10Game.addRound(
      s,
      { entries: { 1: { pointsAdded: 0, completed: true }, 2: { pointsAdded: 50, completed: true }, 3: { pointsAdded: 80, completed: false } } },
      P,
      cfg
    );
    expect(s.players[1].currentTargetPhase).toBe(2);
    expect(s.players[3].currentTargetPhase).toBe(1);

    const st = phase10Game.computeStandings(s, P, cfg, 'scorecard');
    expect(st.map((x) => x.playerId)).toEqual([1, 2, 3]);
    expect(phase10Game.isGameComplete(s, P, cfg, 'scorecard')).toBe(false);

    s = phase10Game.undoLastRound(s, P, cfg);
    expect(s.players[1].completedPhases).toEqual([]);
  });

  it('ends when someone completes all 10 phases', () => {
    let s = phase10Game.createInitialState([1, 2], cfg, 'scorecard') as Phase10State;
    for (let i = 0; i < 10; i++) {
      s = phase10Game.addRound(s, { entries: { 1: { pointsAdded: 0, completed: true }, 2: { pointsAdded: 10, completed: false } } }, [1, 2], cfg);
    }
    expect(phase10Game.isGameComplete(s, [1, 2], cfg, 'scorecard')).toBe(true);
    const st = phase10Game.computeStandings(s, [1, 2], cfg, 'scorecard');
    expect(st[0]).toMatchObject({ playerId: 1, isWinner: true });
    expect(phase10Game.extractPlayerStats(s, 1, st[0], cfg, 'scorecard')).toMatchObject({ phasesCompleted: 10, clearedAllTen: 1 });
  });

  it('supports free-choice phase order', () => {
    const free = { phaseOrder: 'free_choice' as const };
    let s = phase10Game.createInitialState([1, 2], free, 'scorecard') as Phase10State;
    s = phase10Game.addRound(s, { entries: { 1: { pointsAdded: 0, completed: true, phaseNumber: 7 }, 2: { pointsAdded: 5, completed: false } } }, [1, 2], free);
    expect(s.players[1].completedPhases).toEqual([7]);
    expect(s.players[1].currentTargetPhase).toBe(1);
  });
});

describe('Uno', () => {
  it('winner collects points and game ends at target', () => {
    const cfg = { targetScore: 100, scoringVariant: 'winner_collects' as const };
    let s = unoGame.createInitialState(P, cfg, 'scorecard') as UnoState;
    s = unoGame.addRound(s, { roundWinnerId: 2, pointsByPlayer: { 2: 60 } }, P, cfg);
    s = unoGame.addRound(s, { roundWinnerId: 2, pointsByPlayer: { 2: 45 } }, P, cfg);
    expect(s.totals).toEqual({ 1: 0, 2: 105, 3: 0 });
    expect(unoGame.isGameComplete(s, P, cfg, 'scorecard')).toBe(true);
    const st = unoGame.computeStandings(s, P, cfg, 'scorecard');
    expect(st[0]).toMatchObject({ playerId: 2, isWinner: true });
    expect(unoGame.extractPlayerStats(s, 2, st[0], cfg, 'scorecard')).toMatchObject({ handsWon: 2 });
  });

  it('penalty variant: lowest wins', () => {
    const cfg = { targetScore: 100, scoringVariant: 'penalty_lowest' as const };
    let s = unoGame.createInitialState(P, cfg, 'scorecard') as UnoState;
    s = unoGame.addRound(s, { roundWinnerId: 1, pointsByPlayer: { 1: 999, 2: 30, 3: 110 } }, P, cfg);
    expect(s.totals).toEqual({ 1: 0, 2: 30, 3: 110 });
    const st = unoGame.computeStandings(s, P, cfg, 'scorecard');
    expect(st.map((x) => x.playerId)).toEqual([1, 2, 3]);
  });

  it('quick mode respects placements and ties', () => {
    const q: QuickModeState = {
      kind: 'quick',
      placements: [
        { playerId: 1, placement: 2, score: null },
        { playerId: 2, placement: 1, score: null },
        { playerId: 3, placement: 1, score: null },
      ],
    };
    const st = unoGame.computeStandings(q, P, unoGame.getDefaultConfig(3), 'quick');
    expect(st.filter((x) => x.isWinner).map((x) => x.playerId).sort()).toEqual([2, 3]);
  });
});

describe("That's Not a Hat", () => {
  const cfg = thatsNotAHatGame.getDefaultConfig(3);

  it('tracks penalties until threshold; fewest wins', () => {
    let s = thatsNotAHatGame.createInitialState(P, cfg, 'scorecard') as ThatsNotAHatState;
    expect(() => thatsNotAHatGame.addRound(s, { penaltiesAdded: {} }, P, cfg)).toThrow();
    for (let i = 0; i < 3; i++) s = thatsNotAHatGame.addRound(s, { penaltiesAdded: { 3: 1 } }, P, cfg);
    s = thatsNotAHatGame.addRound(s, { penaltiesAdded: { 2: 1 } }, P, cfg);
    expect(thatsNotAHatGame.isGameComplete(s, P, cfg, 'scorecard')).toBe(true);
    const st = thatsNotAHatGame.computeStandings(s, P, cfg, 'scorecard');
    expect(st[0]).toMatchObject({ playerId: 1, isWinner: true, score: 0 });
    expect(thatsNotAHatGame.extractPlayerStats(s, 1, st[0], cfg, 'scorecard')).toMatchObject({ flawlessGame: 1 });
  });
});

describe('createSimplePointsGame', () => {
  it('builds a working game from metadata only', () => {
    const g = createSimplePointsGame({
      slug: 'skyjo',
      name: 'Skyjo',
      tagline: 't',
      description: 'd',
      minPlayers: 2,
      maxPlayers: 8,
      scoringDirection: 'lowest_wins',
      defaultTargetScore: 100,
      allowNegative: true,
    });
    const cfg = g.getDefaultConfig(2);
    let s = g.createInitialState([1, 2], cfg, 'scorecard') as any;
    s = g.addRound(s, { pointsByPlayer: { 1: -5, 2: 60 } }, [1, 2], cfg);
    s = g.addRound(s, { pointsByPlayer: { 1: 10, 2: 50 } }, [1, 2], cfg);
    expect(g.isGameComplete(s, [1, 2], cfg, 'scorecard')).toBe(true);
    expect(g.computeStandings(s, [1, 2], cfg, 'scorecard')[0].playerId).toBe(1);
    s = g.undoLastRound(s, [1, 2], cfg);
    expect(s.totals).toEqual({ 1: -5, 2: 60 });
  });
});
