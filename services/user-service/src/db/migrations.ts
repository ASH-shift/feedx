import { pool } from './client';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (follower_id, following_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    await client.query('COMMIT');
    console.log('[User Service] Migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[User Service] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
