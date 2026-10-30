import { Router } from 'express';
import { requireAdmin } from '../../security/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../../db/pool.js';

export const dashboardRouter = Router();

// GET /admin/dashboard — stats
dashboardRouter.get('/', requireAdmin, asyncHandler(async (_req, res) => {
  const { rows } = await query<{
    total_requests: string;
    expected_amount: string;
    collected_amount: string;
    paid: string;
    unpaid: string;
    pending: string;
    failed: string;
  }>(
    `SELECT COUNT(*)::int AS total_requests,
            COALESCE(SUM(amount), 0)::numeric AS expected_amount,
            COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric AS collected_amount,
            COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
            COUNT(*) FILTER (WHERE status IN ('CREATED','PAYMENT_PENDING','PAYMENT_FAILED'))::int AS unpaid,
            COUNT(*) FILTER (WHERE status = 'PAYMENT_PENDING')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'PAYMENT_FAILED')::int AS failed
     FROM renewal_orders`,
  );
  const r = rows[0];
  res.json({
    total_requests: Number(r.total_requests),
    expected_amount: Number(r.expected_amount),
    collected_amount: Number(r.collected_amount),
    counts: {
      paid: Number(r.paid),
      unpaid: Number(r.unpaid),
      pending: Number(r.pending),
      failed: Number(r.failed),
    },
  });
}));
