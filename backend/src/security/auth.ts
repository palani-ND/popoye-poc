import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { signSession, verifySession } from './encryption.js';
import { query } from '../db/pool.js';

export interface AdminSession {
  sub: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateAdmin(email: string, password: string): Promise<AdminSession | null> {
  const { rows } = await query<{ id: string; email: string; password_hash: string; role: string }>(
    'SELECT id, email, password_hash, role FROM admin_users WHERE email = $1',
    [email],
  );
  if (rows.length === 0) return null;
  const admin = rows[0];
  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok) return null;
  return { sub: admin.id, email: admin.email, role: admin.role };
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return signSession(session.sub, session.email, session.role);
}

export async function readSession(token: string): Promise<AdminSession | null> {
  try {
    const payload = await verifySession<{ email?: string; role?: string }>(token);
    return { sub: token, email: payload.email ?? '', role: payload.role ?? 'VIEWER' };
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_session as string | undefined;
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  readSession(token)
    .then((session) => {
      if (!session) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } });
        return;
      }
      (req as Request & { admin?: AdminSession }).admin = session;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });
    });
}
