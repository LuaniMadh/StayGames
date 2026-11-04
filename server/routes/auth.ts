import { Router } from 'express';
import { AuthUser } from '../../shared/types.js';
import { config } from '../config.js';
import {
  extractTokenFromRequest,
  signAuthToken,
} from '../middleware/auth.js';
import { authenticateLdapUser } from '../services/ldapService.js';
import { getPlayerById, upsertLdapPlayer } from '../services/playerService.js';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

authRouter.get('/status', async (req, res) => {
  const token = extractTokenFromRequest(req);
  let user: AuthUser | null = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;
      const freshPlayer = await getPlayerById(decoded.playerId).catch(() => null);
      user = {
        playerId: decoded.playerId,
        username: decoded.username,
        displayName: freshPlayer?.displayName ?? decoded.displayName,
        email: freshPlayer?.email ?? decoded.email ?? null,
        avatarColor: freshPlayer?.avatarColor ?? decoded.avatarColor,
        ldapUid: decoded.ldapUid ?? null,
      };
    } catch {
      user = null;
    }
  }

  res.json({
    authenticated: Boolean(user),
    user,
    ldapInfo: {
      mockMode: config.ldap.mockMode,
      baseDn: config.ldap.baseDn,
    },
  });
});

authRouter.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const ldapUser = await authenticateLdapUser(username, password);
    if (!ldapUser) {
      res.status(401).json({ error: 'Invalid LDAP username or password.' });
      return;
    }

    const player = await upsertLdapPlayer(ldapUser);

    const authUser: AuthUser = {
      playerId: player.id,
      username: ldapUser.username,
      displayName: player.displayName,
      email: player.email,
      avatarColor: player.avatarColor,
      ldapUid: player.ldapUid,
    };

    const token = signAuthToken(authUser);
    res.cookie(config.jwt.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.jwt.cookieSecure,
      maxAge: config.jwt.expiresInSeconds * 1000,
      path: '/',
    });

    res.json({
      user: authUser,
      token,
    });
  } catch (err: any) {
    res.status(502).json({
      error: err?.message || 'Unable to authenticate against LDAP directory.',
    });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(config.jwt.cookieName, { path: '/' });
  res.json({ ok: true });
});
