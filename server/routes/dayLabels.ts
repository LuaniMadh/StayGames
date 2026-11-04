import { Router } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { DayLabel } from '../../shared/types.js';
import { getPool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const dayLabelsRouter = Router();

dayLabelsRouter.use(requireAuth);

dayLabelsRouter.get('/', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(day, '%Y-%m-%d') as day, title FROM day_labels ORDER BY day DESC`
    );
    const labels: DayLabel[] = rows.map((r) => ({
      day: String(r.day),
      title: String(r.title),
    }));
    res.json({ labels });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch day labels.' });
  }
});

dayLabelsRouter.put('/:day', async (req, res) => {
  try {
    const day = String(req.params.day).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.status(400).json({ error: 'Day must be in YYYY-MM-DD format.' });
      return;
    }
    const title = String(req.body?.title || '').trim();
    const pool = getPool();

    if (!title) {
      await pool.query('DELETE FROM day_labels WHERE day = ?', [day]);
      res.json({ day, title: null });
      return;
    }

    if (title.length > 200) {
      res.status(400).json({ error: 'Day title cannot exceed 200 characters.' });
      return;
    }

    await pool.query(
      `INSERT INTO day_labels (day, title, updated_by_player_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), updated_by_player_id = VALUES(updated_by_player_id)`,
      [day, title, req.user?.playerId ?? null]
    );

    res.json({ day, title });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update day label.' });
  }
});
