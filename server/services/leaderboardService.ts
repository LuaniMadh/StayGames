import { RowDataPacket } from 'mysql2/promise';
import { getGameBySlug, toGameMetadata } from '../../shared/games/index.js';
import {
  GameDefinition,
  GameLeaderboardResponse,
  GameLeaderboardRow,
  OverallLeaderboardRow,
} from '../../shared/types.js';
import { getPool } from '../db/pool.js';

export interface CompletedParticipationRecord {
  sessionId: number;
  gameSlug: string;
  playerId: number;
  displayName: string;
  avatarColor: string;
  isGuest: boolean;
  finalScore: number | null;
  placement: number | null;
  isWinner: boolean;
  stats: Record<string, any>;
}

function parseStatsJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as Record<string, any>;
}

export function computeOverallLeaderboardFromRecords(
  records: CompletedParticipationRecord[]
): OverallLeaderboardRow[] {
  const byPlayer = new Map<
    number,
    {
      playerId: number;
      displayName: string;
      avatarColor: string;
      isGuest: boolean;
      gamesPlayed: number;
      wins: number;
      podiums: number;
      gameCounts: Map<string, number>;
    }
  >();

  for (const r of records) {
    let acc = byPlayer.get(r.playerId);
    if (!acc) {
      acc = {
        playerId: r.playerId,
        displayName: r.displayName,
        avatarColor: r.avatarColor,
        isGuest: r.isGuest,
        gamesPlayed: 0,
        wins: 0,
        podiums: 0,
        gameCounts: new Map(),
      };
      byPlayer.set(r.playerId, acc);
    }

    acc.gamesPlayed += 1;
    if (r.isWinner) acc.wins += 1;
    if (r.placement !== null && r.placement <= 3) acc.podiums += 1;
    acc.gameCounts.set(r.gameSlug, (acc.gameCounts.get(r.gameSlug) ?? 0) + 1);
  }

  const unsorted = Array.from(byPlayer.values()).map((p) => {
    let favoriteGameSlug: string | null = null;
    let maxCount = 0;
    for (const [slug, count] of p.gameCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        favoriteGameSlug = slug;
      }
    }

    const winRate =
      p.gamesPlayed > 0
        ? Math.round((p.wins / p.gamesPlayed) * 1000) / 10
        : 0;

    return {
      rank: 1,
      playerId: p.playerId,
      displayName: p.displayName,
      avatarColor: p.avatarColor,
      isGuest: p.isGuest,
      gamesPlayed: p.gamesPlayed,
      wins: p.wins,
      winRate,
      podiums: p.podiums,
      distinctGamesPlayed: p.gameCounts.size,
      favoriteGameSlug,
    };
  });

  unsorted.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      b.podiums - a.podiums ||
      b.gamesPlayed - a.gamesPlayed ||
      a.displayName.localeCompare(b.displayName)
  );

  let currentRank = 1;
  return unsorted.map((row, idx) => {
    if (idx > 0) {
      const prev = unsorted[idx - 1];
      if (
        prev.wins !== row.wins ||
        prev.winRate !== row.winRate ||
        prev.podiums !== row.podiums
      ) {
        currentRank = idx + 1;
      }
    }
    return { ...row, rank: currentRank };
  });
}

export function computeGameLeaderboardFromRecords(
  game: GameDefinition<any, any, any>,
  records: CompletedParticipationRecord[]
): GameLeaderboardResponse {
  const gameRecords = records.filter((r) => r.gameSlug === game.slug);
  const distinctSessionIds = new Set(gameRecords.map((r) => r.sessionId));

  const byPlayer = new Map<
    number,
    {
      playerId: number;
      displayName: string;
      avatarColor: string;
      isGuest: boolean;
      gamesPlayed: number;
      wins: number;
      placements: number[];
      scores: number[];
      statsList: Record<string, any>[];
    }
  >();

  for (const r of gameRecords) {
    let acc = byPlayer.get(r.playerId);
    if (!acc) {
      acc = {
        playerId: r.playerId,
        displayName: r.displayName,
        avatarColor: r.avatarColor,
        isGuest: r.isGuest,
        gamesPlayed: 0,
        wins: 0,
        placements: [],
        scores: [],
        statsList: [],
      };
      byPlayer.set(r.playerId, acc);
    }

    acc.gamesPlayed += 1;
    if (r.isWinner) acc.wins += 1;
    if (r.placement !== null) acc.placements.push(r.placement);
    if (r.finalScore !== null) acc.scores.push(r.finalScore);
    acc.statsList.push(r.stats || {});
  }

  const unsorted: GameLeaderboardRow[] = Array.from(byPlayer.values()).map(
    (p) => {
      const winRate =
        p.gamesPlayed > 0
          ? Math.round((p.wins / p.gamesPlayed) * 1000) / 10
          : 0;
      const avgPlacement =
        p.placements.length > 0
          ? Math.round(
              (p.placements.reduce((s, v) => s + v, 0) / p.placements.length) *
                100
            ) / 100
          : 0;

      let bestScore: number | null = null;
      let avgScore: number | null = null;
      if (p.scores.length > 0) {
        bestScore =
          game.scoringDirection === 'highest_wins'
            ? Math.max(...p.scores)
            : Math.min(...p.scores);
        avgScore =
          Math.round(
            (p.scores.reduce((s, v) => s + v, 0) / p.scores.length) * 10
          ) / 10;
      }

      const customMetrics: Record<string, number | null> = {};
      for (const col of game.leaderboardColumns) {
        const nums = p.statsList
          .map((st) => Number(st[col.statKey]))
          .filter((v) => Number.isFinite(v));

        if (col.aggregate === 'ratio_percent' && col.denominatorStatKey) {
          const numSum = nums.reduce((s, v) => s + v, 0);
          const denSum = p.statsList
            .map((st) => Number(st[col.denominatorStatKey!]))
            .filter((v) => Number.isFinite(v))
            .reduce((s, v) => s + v, 0);
          customMetrics[col.key] =
            denSum > 0 ? Math.round((numSum / denSum) * 1000) / 10 : null;
        } else if (nums.length === 0) {
          customMetrics[col.key] = null;
        } else if (col.aggregate === 'sum') {
          customMetrics[col.key] = nums.reduce((s, v) => s + v, 0);
        } else if (col.aggregate === 'max') {
          customMetrics[col.key] = Math.max(...nums);
        } else if (col.aggregate === 'min') {
          customMetrics[col.key] = Math.min(...nums);
        } else if (col.aggregate === 'avg') {
          customMetrics[col.key] =
            Math.round(
              (nums.reduce((s, v) => s + v, 0) / nums.length) * 100
            ) / 100;
        }
      }

      return {
        rank: 1,
        playerId: p.playerId,
        displayName: p.displayName,
        avatarColor: p.avatarColor,
        isGuest: p.isGuest,
        gamesPlayed: p.gamesPlayed,
        wins: p.wins,
        winRate,
        avgPlacement,
        bestScore,
        avgScore,
        customMetrics,
      };
    }
  );

  unsorted.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      (a.avgPlacement || 99) - (b.avgPlacement || 99) ||
      b.gamesPlayed - a.gamesPlayed ||
      a.displayName.localeCompare(b.displayName)
  );

  let currentRank = 1;
  const rows = unsorted.map((row, idx) => {
    if (idx > 0) {
      const prev = unsorted[idx - 1];
      if (
        prev.wins !== row.wins ||
        prev.winRate !== row.winRate ||
        prev.avgPlacement !== row.avgPlacement
      ) {
        currentRank = idx + 1;
      }
    }
    return { ...row, rank: currentRank };
  });

  return {
    game: toGameMetadata(game),
    totalSessions: distinctSessionIds.size,
    rows,
  };
}

async function fetchCompletedParticipations(
  gameSlug?: string
): Promise<CompletedParticipationRecord[]> {
  const pool = getPool();
  const params: any[] = [];
  const gameFilter = gameSlug ? 'AND gs.game_slug = ?' : '';
  if (gameSlug) params.push(gameSlug);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       gs.id AS session_id,
       gs.game_slug,
       sp.player_id,
       sp.final_score,
       sp.placement,
       sp.is_winner,
       sp.stats_json,
       p.display_name,
       p.avatar_color,
       p.is_guest
     FROM session_players sp
     INNER JOIN game_sessions gs ON gs.id = sp.session_id
     INNER JOIN players p ON p.id = sp.player_id
     WHERE gs.status = 'completed' ${gameFilter}`,
    params
  );

  return rows.map((r) => ({
    sessionId: Number(r.session_id),
    gameSlug: String(r.game_slug),
    playerId: Number(r.player_id),
    displayName: String(r.display_name),
    avatarColor: String(r.avatar_color || '#6366f1'),
    isGuest: Boolean(r.is_guest),
    finalScore:
      r.final_score !== null && r.final_score !== undefined
        ? Number(r.final_score)
        : null,
    placement:
      r.placement !== null && r.placement !== undefined
        ? Number(r.placement)
        : null,
    isWinner: Boolean(r.is_winner),
    stats: parseStatsJson(r.stats_json),
  }));
}

export async function getOverallLeaderboard(): Promise<{
  totalCompletedSessions: number;
  rows: OverallLeaderboardRow[];
}> {
  const records = await fetchCompletedParticipations();
  const totalCompletedSessions = new Set(records.map((r) => r.sessionId)).size;
  const rows = computeOverallLeaderboardFromRecords(records);
  return { totalCompletedSessions, rows };
}

export async function getGameLeaderboard(
  gameSlug: string
): Promise<GameLeaderboardResponse> {
  const game = getGameBySlug(gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${gameSlug}".`);
  }
  const records = await fetchCompletedParticipations(gameSlug);
  return computeGameLeaderboardFromRecords(game, records);
}
