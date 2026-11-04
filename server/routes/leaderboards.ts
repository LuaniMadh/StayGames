import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getGameLeaderboard,
  getOverallLeaderboard,
} from '../services/leaderboardService.js';

export const leaderboardsRouter = Router();

leaderboardsRouter.use(requireAuth);

leaderboardsRouter.get('/', async (_req, res) => {
  try {
    const data = await getOverallLeaderboard();
    res.json(data);
  } catch (err: any) {
    res
      .status(500)
      .json({ error: err?.message || 'Failed to compute overall leaderboard.' });
  }
});

leaderboardsRouter.get('/:gameSlug', async (req, res) => {
  try {
    const data = await getGameLeaderboard(req.params.gameSlug);
    res.json(data);
  } catch (err: any) {
    const status = /Unknown game module/i.test(String(err?.message))
      ? 404
      : 500;
    res
      .status(status)
      .json({ error: err?.message || 'Failed to compute game leaderboard.' });
  }
});
