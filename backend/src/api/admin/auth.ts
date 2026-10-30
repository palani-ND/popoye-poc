import { Router } from 'express';
import { z } from 'zod';
import { authenticateAdmin, createSessionToken, requireAdmin } from '../../security/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../../domain/audit.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(400, 'VALIDATION', 'Invalid email or password');
  const { email, password } = parsed.data;
  const session = await authenticateAdmin(email, password);
  if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  const token = await createSessionToken(session);
  res.cookie('admin_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
  });
  await logAudit({ actor: email, action: 'admin_login', resource: 'admin_user', resourceId: session.sub });
  res.json({ email: session.email, role: session.role });
}));

authRouter.post('/logout', requireAdmin, (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

authRouter.get('/me', requireAdmin, (req, res) => {
  const admin = (req as typeof req & { admin?: { email: string; role: string } }).admin;
  res.json({ email: admin?.email, role: admin?.role });
});