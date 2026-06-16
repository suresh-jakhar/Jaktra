

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

export interface DatabaseClientOptions {
  connectionString: string;
  maxConnections?: number;
}

export function createDatabaseClient(options: DatabaseClientOptions) {
  const pool = new Pool({
    connectionString: options.connectionString,
    statement_timeout: 30000,  
    query_timeout: 30000,
    connectionTimeoutMillis: process.env['NODE_ENV'] === 'test' ? 15000 : 5000,
    idleTimeoutMillis: 30000,
    max: options.maxConnections ?? (process.env['NODE_ENV'] === 'test' ? 2 : 20),
  });

  const db = drizzle(pool, { schema });
  (db as any).$pool = pool;
  return db;
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
