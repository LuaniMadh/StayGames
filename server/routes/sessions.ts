import { Router } from 'express';
import { GameMode, SessionStatus } from '../../shared/types.js';
import { requireAuth } from '../middleware/auth.js';
import {
  appendSessionRound,
  completeSession,
  createSession,
  deleteSession,
  editSessionRound,
  getSessionById,
  listSessions,
  undoSessionRound,
  updateSessionNotes,
  updateSessionState,
} from '../services/sessionService.js';

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

sessionsRouter.get('/', async (req, res) => {
  try {
    const sessions = await listSessions({
      gameSlug: req.query.gameSlug ? String(req.query.gameSlug) : undefined,
      status: req.query.status
        ? (String(req.query.status) as SessionStatus)
        : undefined,
      playerId: req.query.playerId ? Number(req.query.playerId) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load sessions.' });
  }
});

sessionsRouter.get('/:id', async (req, res) => {
  try {
    const session = await getSessionById(Number(req.params.id));
    if (!session) {
      res.status(404).json({ error: 'Game session not found.' });
      return;
    }
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load session.' });
  }
});

sessionsRouter.post('/', async (req, res) => {
  try {
    const { gameSlug, mode, playerIds, config, notes, quickPlacements } =
      req.body ?? {};
    if (!gameSlug || !Array.isArray(playerIds)) {
      res
        .status(400)
        .json({ error: 'gameSlug and playerIds array are required.' });
      return;
    }

    const session = await createSession({
      gameSlug: String(gameSlug),
      mode: mode ? (String(mode) as GameMode) : undefined,
      playerIds: playerIds.map(Number),
      config: config && typeof config === 'object' ? config : undefined,
      notes: notes ? String(notes) : undefined,
      createdByPlayerId: req.user?.playerId ?? null,
      quickPlacements: Array.isArray(quickPlacements)
        ? quickPlacements
        : undefined,
    });

    res.status(201).json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create session.' });
  }
});

sessionsRouter.post('/:id/rounds', async (req, res) => {
  try {
    const session = await appendSessionRound(
      Number(req.params.id),
      req.body?.roundInput ?? req.body
    );
    res.json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to record round.' });
  }
});

sessionsRouter.put('/:id/rounds/:roundNumber', async (req, res) => {
  try {
    const session = await editSessionRound(
      Number(req.params.id),
      Number(req.params.roundNumber),
      req.body?.roundInput ?? req.body
    );
    res.json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to edit round.' });
  }
});

sessionsRouter.patch('/:id/notes', async (req, res) => {
  try {
    const session = await updateSessionNotes(
      Number(req.params.id),
      req.body?.notes !== undefined ? String(req.body.notes) : null
    );
    res.json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update notes.' });
  }
});

sessionsRouter.put('/:id/state', async (req, res) => {
  try {
    if (!req.body || req.body.state === undefined) {
      res.status(400).json({ error: 'state object is required.' });
      return;
    }
    const session = await updateSessionState(
      Number(req.params.id),
      req.body.state
    );
    res.json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update session state.' });
  }
});

sessionsRouter.post('/:id/undo', async (req, res) => {
  try {
    const session = await undoSessionRound(Number(req.params.id));
    res.json({ session });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to undo round.' });
  }
});

sessionsRouter.post('/:id/complete', async (req, res) => {
  try {
    const session = await completeSession(Number(req.params.id), {
      notes: req.body?.notes,
      quickPlacements: Array.isArray(req.body?.quickPlacements)
        ? req.body.quickPlacements
        : undefined,
    });
    res.json({ session });
  } catch (err: any) {
    res
      .status(400)
      .json({ error: err?.message || 'Failed to complete session.' });
  }
});

sessionsRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteSession(Number(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Game session not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete session.' });
  }
});
