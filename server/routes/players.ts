import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createGuestPlayer,
  linkGuestToLdapAccount,
  listPlayers,
  syncRosterFromLdap,
  updatePlayerActiveStatus,
} from '../services/playerService.js';

import { fetchAllLdapUsers } from '../services/ldapService.js';
import { LdapDirectoryAccount } from '../../shared/types.js';

export const playersRouter = Router();

playersRouter.use(requireAuth);

playersRouter.get('/directory-accounts', async (_req, res) => {
  try {
    const [directoryUsers, localPlayers] = await Promise.all([
      fetchAllLdapUsers(),
      listPlayers(true),
    ]);
    const byUid = new Map<string, number>();
    for (const p of localPlayers) {
      if (p.ldapUid) byUid.set(p.ldapUid.toLowerCase(), p.id);
      if (p.username) byUid.set(p.username.toLowerCase(), p.id);
    }
    const accounts: LdapDirectoryAccount[] = directoryUsers.map((u) => ({
      uid: u.uid,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      linkedPlayerId: byUid.get(u.uid.toLowerCase()) ?? byUid.get(u.username.toLowerCase()) ?? null,
    }));
    res.json({ accounts });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Failed to fetch directory accounts.' });
  }
});

playersRouter.post('/:id/link-ldap', async (req, res) => {
  try {
    const guestPlayerId = Number(req.params.id);
    const ldapUid = String(req.body?.ldapUid || '');
    if (!ldapUid) {
      res.status(400).json({ error: 'ldapUid is required.' });
      return;
    }
    const player = await linkGuestToLdapAccount(guestPlayerId, ldapUid);
    res.json({ player });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to link guest to LDAP account.' });
  }
});

playersRouter.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const players = await listPlayers(includeInactive);
    res.json({ players });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch players.' });
  }
});

playersRouter.post('/sync-ldap', async (_req, res) => {
  try {
    const result = await syncRosterFromLdap();
    res.json(result);
  } catch (err: any) {
    res.status(502).json({
      error: err?.message || 'Failed to synchronize players from LDAP.',
    });
  }
});

playersRouter.post('/guest', async (req, res) => {
  try {
    const displayName = String(req.body?.displayName || '');
    const player = await createGuestPlayer(displayName);
    res.status(201).json({ player });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create guest.' });
  }
});

playersRouter.patch('/:id/active', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isActive = Boolean(req.body?.isActive);
    const player = await updatePlayerActiveStatus(id, isActive);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    res.json({ player });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update player.' });
  }
});

playersRouter.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = (await import('../db/pool.js')).getPool();
    const [sessions] = await pool.query<any[]>(
      'SELECT COUNT(*) as cnt FROM session_players WHERE player_id = ?',
      [id]
    );
    if ((sessions[0]?.cnt || 0) > 0) {
      await updatePlayerActiveStatus(id, false);
      res.json({ message: 'Player has match history and was deactivated instead of deleted.' });
      return;
    }
    await pool.query('DELETE FROM players WHERE id = ?', [id]);
    res.json({ message: 'Player deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete player.' });
  }
});
