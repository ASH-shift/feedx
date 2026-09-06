import { pool } from './client';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        username VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('[Post Service] Migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Post Service] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
