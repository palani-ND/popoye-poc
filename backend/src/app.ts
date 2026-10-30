import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { paymentRouter } from './api/public/payment.js';
import { webhookRouter } from './api/webhook.js';
import { authRouter } from './api/admin/auth.js';
import { ordersRouter } from './api/admin/orders.js';
import { dashboardRouter } from './api/admin/dashboard.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { errorHandler, notFound } from './api/middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        // Preserve the raw body for webhook signature verification.
        (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/webhooks', webhookRouter);
  app.use('/api', paymentRouter);
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/orders', ordersRouter);
  app.use('/api/admin/dashboard', dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
