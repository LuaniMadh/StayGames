import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getGameBySlug } from '../../shared/games/index.js';
import {
  GameMode,
  GameSession,
  QuickModeState,
  QuickResultEntry,
  SessionParticipant,
  SessionStatus,
  StandingEntry,
} from '../../shared/types.js';
import { getPool } from '../db/pool.js';

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

export interface CreateSessionInput {
  gameSlug: string;
  mode?: GameMode;
  playerIds: number[];
  config?: Record<string, any>;
  notes?: string;
  createdByPlayerId?: number | null;
  quickPlacements?: QuickResultEntry[];
}

export interface ListSessionsFilter {
  gameSlug?: string;
  status?: SessionStatus;
  playerId?: number;
  limit?: number;
}

async function hydrateSessions(
  sessionRows: RowDataPacket[]
): Promise<GameSession[]> {
  if (sessionRows.length === 0) return [];

  const pool = getPool();
  const sessionIds = sessionRows.map((r) => Number(r.id));
  const [participantRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       sp.session_id,
       sp.player_id,
       sp.seat_order,
       sp.final_score,
       sp.placement,
       sp.is_winner,
       sp.stats_json,
       p.display_name,
       p.avatar_color,
       p.is_guest
     FROM session_players sp
     INNER JOIN players p ON p.id = sp.player_id
     WHERE sp.session_id IN (?)
     ORDER BY sp.seat_order ASC`,
    [sessionIds]
  );

  const bySession = new Map<number, SessionParticipant[]>();
  for (const row of participantRows) {
    const sid = Number(row.session_id);
    const list = bySession.get(sid) ?? [];
    list.push({
      playerId: Number(row.player_id),
      displayName: String(row.display_name),
      avatarColor: String(row.avatar_color || '#6366f1'),
      isGuest: Boolean(row.is_guest),
      seatOrder: Number(row.seat_order),
      finalScore:
        row.final_score !== null && row.final_score !== undefined
          ? Number(row.final_score)
          : null,
      placement:
        row.placement !== null && row.placement !== undefined
          ? Number(row.placement)
          : null,
      isWinner: Boolean(row.is_winner),
      stats: parseJsonColumn<Record<string, any>>(row.stats_json, {}),
    });
    bySession.set(sid, list);
  }

  return sessionRows.map((row) => {
    const id = Number(row.id);
    const mode = row.mode as GameMode;
    const config = parseJsonColumn<Record<string, any>>(row.config_json, {});
    const state = parseJsonColumn<any>(row.state_json, {});
    const participants = bySession.get(id) ?? [];
    const playerIds = participants.map((p) => p.playerId);

    const game = getGameBySlug(String(row.game_slug));
    let standings: StandingEntry[] | undefined;
    let isComplete: boolean | undefined;

    if (game) {
      try {
        standings = game.computeStandings(state, playerIds, config, mode);
        isComplete = game.isGameComplete(state, playerIds, config, mode);
      } catch {
        // Safe ignore if custom state is still initializing
      }
    }

    return {
      id,
      gameSlug: String(row.game_slug),
      mode,
      status: row.status as SessionStatus,
      config,
      state,
      notes: row.notes ?? null,
      createdByPlayerId:
        row.created_by_player_id !== null
          ? Number(row.created_by_player_id)
          : null,
      startedAt: new Date(row.started_at).toISOString(),
      completedAt: row.completed_at
        ? new Date(row.completed_at).toISOString()
        : null,
      participants,
      standings,
      isComplete,
    };
  });
}

export async function getSessionById(id: number): Promise<GameSession | null> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM game_sessions WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  const hydrated = await hydrateSessions(rows);
  return hydrated[0] ?? null;
}

export async function listSessions(
  filter: ListSessionsFilter = {}
): Promise<GameSession[]> {
  const pool = getPool();
  const where: string[] = [];
  const params: any[] = [];

  if (filter.gameSlug) {
    where.push('gs.game_slug = ?');
    params.push(filter.gameSlug);
  }
  if (filter.status) {
    where.push('gs.status = ?');
    params.push(filter.status);
  }
  if (filter.playerId) {
    where.push(
      'EXISTS (SELECT 1 FROM session_players spf WHERE spf.session_id = gs.id AND spf.player_id = ?)'
    );
    params.push(filter.playerId);
  }

  const limit = Math.min(200, Math.max(1, Number(filter.limit || 50)));
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT gs.*
     FROM game_sessions gs
     ${whereClause}
     ORDER BY COALESCE(gs.completed_at, gs.started_at) DESC, gs.id DESC
     LIMIT ?`,
    [...params, limit]
  );

  return hydrateSessions(rows);
}

export async function createSession(
  input: CreateSessionInput
): Promise<GameSession> {
  const game = getGameBySlug(input.gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${input.gameSlug}".`);
  }

  const mode: GameMode = input.mode ?? game.defaultMode;
  if (!game.supportedModes.includes(mode)) {
    throw new Error(`Game "${game.name}" does not support mode "${mode}".`);
  }

  const uniquePlayers = Array.from(new Set(input.playerIds.map(Number)));
  if (
    uniquePlayers.length < game.minPlayers ||
    uniquePlayers.length > game.maxPlayers
  ) {
    throw new Error(
      `${game.name} requires between ${game.minPlayers} and ${game.maxPlayers} unique players.`
    );
  }

  const mergedConfig = {
    ...game.getDefaultConfig(uniquePlayers.length),
    ...(input.config ?? {}),
  };

  if (game.validateConfig) {
    game.validateConfig(mergedConfig);
  }

  let initialState = game.createInitialState(uniquePlayers, mergedConfig, mode);
  const finishImmediately =
    mode === 'quick' &&
    Array.isArray(input.quickPlacements) &&
    input.quickPlacements.length === uniquePlayers.length;

  if (finishImmediately && input.quickPlacements) {
    initialState = {
      kind: 'quick',
      placements: input.quickPlacements,
    } satisfies QuickModeState;
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  let sessionId = 0;

  try {
    await conn.beginTransaction();

    const [checkPlayers] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM players WHERE id IN (?)',
      [uniquePlayers]
    );
    if (checkPlayers.length !== uniquePlayers.length) {
      throw new Error('One or more selected players do not exist.');
    }

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO game_sessions
        (game_slug, mode, status, config_json, state_json, notes, created_by_player_id, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${finishImmediately ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      [
        game.slug,
        mode,
        finishImmediately ? 'completed' : 'in_progress',
        JSON.stringify(mergedConfig),
        JSON.stringify(initialState),
        input.notes?.trim() || null,
        input.createdByPlayerId ?? null,
      ]
    );

    sessionId = res.insertId;

    const standings = finishImmediately
      ? game.computeStandings(initialState, uniquePlayers, mergedConfig, mode)
      : [];

    for (let i = 0; i < uniquePlayers.length; i++) {
      const pid = uniquePlayers[i];
      const standing = standings.find((s) => s.playerId === pid);
      const stats = standing
        ? game.extractPlayerStats(
            initialState,
            pid,
            standing,
            mergedConfig,
            mode
          )
        : {};

      await conn.query(
        `INSERT INTO session_players
          (session_id, player_id, seat_order, final_score, placement, is_winner, stats_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          pid,
          i,
          standing ? standing.score : null,
          standing ? standing.rank : null,
          standing && standing.isWinner ? 1 : 0,
          JSON.stringify(stats),
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const created = await getSessionById(sessionId);
  if (!created) {
    throw new Error('Failed to load newly created session.');
  }
  return created;
}

export async function appendSessionRound(
  sessionId: number,
  roundInput: any
): Promise<GameSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Game session not found.');
  }
  if (session.status !== 'in_progress') {
    throw new Error('Cannot add rounds to a finished session.');
  }
  if (session.mode !== 'scorecard') {
    throw new Error('Round updates are only supported in scorecard mode.');
  }

  const game = getGameBySlug(session.gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${session.gameSlug}".`);
  }

  const playerIds = session.participants
    .slice()
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((p) => p.playerId);

  const nextState = game.addRound(
    session.state,
    roundInput,
    playerIds,
    session.config
  );

  const pool = getPool();
  await pool.query('UPDATE game_sessions SET state_json = ? WHERE id = ?', [
    JSON.stringify(nextState),
    sessionId,
  ]);

  const updated = await getSessionById(sessionId);
  if (!updated) throw new Error('Failed to reload updated session.');
  return updated;
}

export async function editSessionRound(
  sessionId: number,
  roundNumber: number,
  roundInput: any
): Promise<GameSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Game session not found.');
  }
  if (session.status !== 'in_progress') {
    throw new Error('Cannot edit rounds of a finished session.');
  }

  const game = getGameBySlug(session.gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${session.gameSlug}".`);
  }
  if (!game.editRound) {
    throw new Error(`Editing rounds is not supported for "${game.name}".`);
  }

  const playerIds = session.participants
    .slice()
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((p) => p.playerId);

  const nextState = game.editRound(
    session.state,
    roundNumber,
    roundInput,
    playerIds,
    session.config
  );

  const pool = getPool();
  await pool.query('UPDATE game_sessions SET state_json = ? WHERE id = ?', [
    JSON.stringify(nextState),
    sessionId,
  ]);

  const updated = await getSessionById(sessionId);
  if (!updated) throw new Error('Failed to reload updated session.');
  return updated;
}

export async function updateSessionNotes(
  sessionId: number,
  notes: string | null
): Promise<GameSession> {
  const pool = getPool();
  await pool.query('UPDATE game_sessions SET notes = ? WHERE id = ?', [
    notes !== null ? notes.trim() || null : null,
    sessionId,
  ]);
  const updated = await getSessionById(sessionId);
  if (!updated) throw new Error('Failed to reload session.');
  return updated;
}

export async function updateSessionState(
  sessionId: number,
  state: any
): Promise<GameSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Game session not found.');
  }
  if (session.status !== 'in_progress') {
    throw new Error('Cannot update state of a finished session.');
  }
  const pool = getPool();
  await pool.query('UPDATE game_sessions SET state_json = ? WHERE id = ?', [
    JSON.stringify(state),
    sessionId,
  ]);
  const updated = await getSessionById(sessionId);
  if (!updated) throw new Error('Failed to reload updated session.');
  return updated;
}

export async function undoSessionRound(
  sessionId: number
): Promise<GameSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Game session not found.');
  }
  if (session.status !== 'in_progress') {
    throw new Error('Cannot undo rounds on a finished session.');
  }

  const game = getGameBySlug(session.gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${session.gameSlug}".`);
  }

  const playerIds = session.participants
    .slice()
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((p) => p.playerId);

  const nextState = game.undoLastRound(
    session.state,
    playerIds,
    session.config
  );

  const pool = getPool();
  await pool.query('UPDATE game_sessions SET state_json = ? WHERE id = ?', [
    JSON.stringify(nextState),
    sessionId,
  ]);

  const updated = await getSessionById(sessionId);
  if (!updated) throw new Error('Failed to reload updated session.');
  return updated;
}

export async function completeSession(
  sessionId: number,
  options: {
    notes?: string;
    quickPlacements?: QuickResultEntry[];
  } = {}
): Promise<GameSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Game session not found.');
  }
  if (session.status === 'completed') {
    return session;
  }

  const game = getGameBySlug(session.gameSlug);
  if (!game) {
    throw new Error(`Unknown game module "${session.gameSlug}".`);
  }

  const playerIds = session.participants
    .slice()
    .sort((a, b) => a.seatOrder - b.seatOrder)
    .map((p) => p.playerId);

  let finalState = session.state;
  if (session.mode === 'quick' && options.quickPlacements) {
    finalState = {
      kind: 'quick',
      placements: options.quickPlacements,
    } satisfies QuickModeState;
  }

  const standings = game.computeStandings(
    finalState,
    playerIds,
    session.config,
    session.mode
  );

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE game_sessions
       SET status = 'completed',
           state_json = ?,
           notes = COALESCE(?, notes),
           completed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [
        JSON.stringify(finalState),
        options.notes !== undefined ? options.notes.trim() || null : null,
        sessionId,
      ]
    );

    for (const pid of playerIds) {
      const standing = standings.find((s) => s.playerId === pid);
      if (!standing) continue;
      const stats = game.extractPlayerStats(
        finalState,
        pid,
        standing,
        session.config,
        session.mode
      );

      await conn.query(
        `UPDATE session_players
         SET final_score = ?,
             placement = ?,
             is_winner = ?,
             stats_json = ?
         WHERE session_id = ? AND player_id = ?`,
        [
          standing.score,
          standing.rank,
          standing.isWinner ? 1 : 0,
          JSON.stringify(stats),
          sessionId,
          pid,
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const completed = await getSessionById(sessionId);
  if (!completed) throw new Error('Failed to reload completed session.');
  return completed;
}

export async function deleteSession(sessionId: number): Promise<boolean> {
  const pool = getPool();
  const [res] = await pool.query<ResultSetHeader>(
    'DELETE FROM game_sessions WHERE id = ?',
    [sessionId]
  );
  return res.affectedRows > 0;
}
