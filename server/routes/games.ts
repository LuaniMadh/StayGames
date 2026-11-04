import { Router } from 'express';
import {
  getAllGames,
  getGameBySlug,
  toGameMetadata,
} from '../../shared/games/index.js';
import { requireAuth } from '../middleware/auth.js';

export const gamesRouter = Router();

gamesRouter.use(requireAuth);

gamesRouter.get('/', (_req, res) => {
  const games = getAllGames().map(toGameMetadata);
  res.json({ games });
});

gamesRouter.get('/:slug', (req, res) => {
  const game = getGameBySlug(req.params.slug);
  if (!game) {
    res.status(404).json({ error: 'Game module not found.' });
    return;
  }
  res.json({ game: toGameMetadata(game) });
});
