import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
});

export type QueryFn = <R extends pg.QueryResultRow = pg.QueryResultRow>(
  queryText: string,
  values?: unknown[],
  queryConfig?: object,
) => Promise<pg.QueryResult<R>>;

export interface Runner {
  query: QueryFn;
}

/** Build a query runner that works against either a transaction client or the pool. */
export function runner(client?: pg.PoolClient): Runner {
  return {
    query: ((text: string, params?: unknown[]) => {
      return client ? client.query(text, params) : query(text, params);
    }) as QueryFn,
  };
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
