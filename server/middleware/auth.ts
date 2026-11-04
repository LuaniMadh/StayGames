import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../../shared/types.js';
import { config } from '../config.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(user, config.jwt.secret, {
    expiresIn: config.jwt.expiresInSeconds,
  });
}

export function extractTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.[config.jwt.cookieName];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in with LDAP.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUser;
    req.user = {
      playerId: decoded.playerId,
      username: decoded.username,
      displayName: decoded.displayName,
      email: decoded.email ?? null,
      avatarColor: decoded.avatarColor,
      ldapUid: decoded.ldapUid ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}
