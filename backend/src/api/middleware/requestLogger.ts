import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Structured request logger with request IDs. Never logs secrets, tokens, or PII bodies. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
      }),
    );
  });

  next();
}
