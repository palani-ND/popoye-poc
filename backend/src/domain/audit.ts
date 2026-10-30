import { query } from '../db/pool.js';

export interface AuditEntry {
  actor: string;
  action: string;
  resource?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

/** Append an immutable audit log entry. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  await query(
    `INSERT INTO audit_logs (actor, action, resource, resource_id, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.actor, entry.action, entry.resource ?? null, entry.resourceId ?? null, entry.meta ?? null],
  );
}
