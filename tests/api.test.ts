import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { wizardGame } from '../shared/games/wizard';
import { createApp } from '../server/app';
import { signAuthToken } from '../server/middleware/auth';
import { escapeLdapFilterValue } from '../server/services/ldapService';
import {
  computeGameLeaderboardFromRecords,
  computeOverallLeaderboardFromRecords,
  type CompletedParticipationRecord,
} from '../server/services/leaderboardService';

function rec(
  sessionId: number,
  gameSlug: string,
  playerId: number,
  placement: number,
  finalScore: number,
  stats: Record<string, any> = {}
): CompletedParticipationRecord {
  return {
    sessionId,
    gameSlug,
    playerId,
    displayName: `P${playerId}`,
    avatarColor: '#000',
    isGuest: false,
    finalScore,
    placement,
    isWinner: placement === 1,
    stats,
  };
}

describe('leaderboard aggregation', () => {
  const records = [
    rec(1, 'wizard', 1, 1, 120, { exactBids: 8, roundsPlayed: 10, zeroBidsHit: 2 }),
    rec(1, 'wizard', 2, 2, 80, { exactBids: 5, roundsPlayed: 10, zeroBidsHit: 1 }),
    rec(2, 'wizard', 1, 2, 60, { exactBids: 4, roundsPlayed: 10, zeroBidsHit: 0 }),
    rec(2, 'wizard', 2, 1, 90, { exactBids: 6, roundsPlayed: 10, zeroBidsHit: 3 }),
    rec(3, 'uno', 1, 1, 500),
    rec(3, 'uno', 3, 2, 100),
  ];

  it('computes overall wins, win rate and favourite game', () => {
    const rows = computeOverallLeaderboardFromRecords(records);
    expect(rows[0]).toMatchObject({ playerId: 1, wins: 2, gamesPlayed: 3, favoriteGameSlug: 'wizard', rank: 1 });
    expect(rows.find((r) => r.playerId === 3)).toMatchObject({ wins: 0, gamesPlayed: 1 });
  });

  it('computes per-game rows with custom modular metrics', () => {
    const lb = computeGameLeaderboardFromRecords(wizardGame, records);
    expect(lb.totalSessions).toBe(2);
    const p1 = lb.rows.find((r) => r.playerId === 1)!;
    expect(p1).toMatchObject({ wins: 1, gamesPlayed: 2, bestScore: 120, avgScore: 90, avgPlacement: 1.5 });
    expect(p1.customMetrics.bidAccuracy).toBe(60);
    expect(p1.customMetrics.zeroBidsHit).toBe(2);
    // Both players tied on wins/rate/avg placement -> shared rank 1
    expect(lb.rows.every((r) => r.rank === 1)).toBe(true);
  });
});

describe('LDAP helpers', () => {
  it('escapes filter injection characters', () => {
    expect(escapeLdapFilterValue('a*)(uid=*')).toBe('a\\2a\\29\\28uid=\\2a');
  });
});

describe('API (no database required)', () => {
  const app = createApp();
  const token = signAuthToken({
    playerId: 1,
    username: 'alice',
    displayName: 'Alice',
    email: null,
    avatarColor: '#000',
    ldapUid: 'alice',
  });

  it('health endpoint is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('protects game endpoints', async () => {
    const res = await request(app).get('/api/games');
    expect(res.status).toBe(401);
  });

  it('lists modular games for authenticated users', async () => {
    const res = await request(app).get('/api/games').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.games.map((g: any) => g.slug)).toContain('phase-10');
    expect(res.body.games[0]).not.toHaveProperty('addRound');
  });

  it('rejects login with missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
  });
});
