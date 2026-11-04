import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { authRouter } from './routes/auth.js';
import { dayLabelsRouter } from './routes/dayLabels.js';
import { gamesRouter } from './routes/games.js';
import { leaderboardsRouter } from './routes/leaderboards.js';
import { playersRouter } from './routes/players.js';
import { pluginDocRouter, pluginsRouter } from './routes/plugins.js';
import { sessionsRouter } from './routes/sessions.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Public plugin API specification route (accessible without auth)
  app.use('/plugins/api', pluginDocRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'staygames' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/plugins', pluginsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/leaderboards', leaderboardsRouter);
  app.use('/api/day-labels', dayLabelsRouter);

  // Serve built React frontend in production / Docker
  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  const indexHtmlPath = path.join(clientDistDir, 'index.html');

  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api/') ||
        req.path === '/plugins/api' ||
        req.path.startsWith('/plugins/api/')
      ) {
        next();
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }

  return app;
}
