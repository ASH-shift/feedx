import * as grpc from '@grpc/grpc-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client';
import { publishEvent } from '../kafka/producer';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';
const SALT_ROUNDS = 10;

function generateToken(userId: string, email: string): string {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

export async function register(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { username, email, password } = call.request;

  try {
    if (!username || !email || !password) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'username, email, and password are required',
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: 'User with this email or username already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.email);

    callback(null, {
      id: user.id,
      username: user.username,
      email: user.email,
      token,
      created_at: user.created_at.toISOString(),
    });
  } catch (error) {
    console.error('[UserHandler] register error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error during registration',
    });
  }
}

export async function login(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { email, password } = call.request;

  try {
    if (!email || !password) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'email and password are required',
      });
    }

    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Invalid email or password',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user.id, user.email);

    callback(null, {
      id: user.id,
      username: user.username,
      email: user.email,
      token,
    });
  } catch (error) {
    console.error('[UserHandler] login error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error during login',
    });
  }
}

export async function getUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { user_id } = call.request;

  try {
    if (!user_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'user_id is required',
      });
    }

    const userResult = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `User with id ${user_id} not found`,
      });
    }

    const user = userResult.rows[0];

    const followersCount = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE following_id = $1',
      [user_id]
    );

    const followingCount = await pool.query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [user_id]
    );

    callback(null, {
      id: user.id,
      username: user.username,
      email: user.email,
      followers_count: parseInt(followersCount.rows[0].count, 10),
      following_count: parseInt(followingCount.rows[0].count, 10),
      created_at: user.created_at.toISOString(),
    });
  } catch (error) {
    console.error('[UserHandler] getUser error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching user',
    });
  }
}

export async function followUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { follower_id, following_id } = call.request;

  try {
    if (!follower_id || !following_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'follower_id and following_id are required',
      });
    }

    if (follower_id === following_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Users cannot follow themselves',
      });
    }

    const followerResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [follower_id]);
    if (followerResult.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Follower user not found',
      });
    }

    const followingResult = await pool.query('SELECT id FROM users WHERE id = $1', [following_id]);
    if (followingResult.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'User to follow not found',
      });
    }

    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [follower_id, following_id]
    );

    await publishEvent('user.followed', {
      followerId: follower_id,
      followerUsername: followerResult.rows[0].username,
      followingId: following_id,
      timestamp: Date.now(),
    });

    callback(null, {
      success: true,
      message: 'Successfully followed user',
    });
  } catch (error) {
    console.error('[UserHandler] followUser error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while following user',
    });
  }
}

export async function unfollowUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { follower_id, following_id } = call.request;

  try {
    if (!follower_id || !following_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'follower_id and following_id are required',
      });
    }

    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [follower_id, following_id]
    );

    callback(null, {
      success: true,
      message: 'Successfully unfollowed user',
    });
  } catch (error) {
    console.error('[UserHandler] unfollowUser error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while unfollowing user',
    });
  }
}

export async function getFollowers(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { user_id } = call.request;

  try {
    if (!user_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'user_id is required',
      });
    }

    const result = await pool.query(
      'SELECT follower_id FROM follows WHERE following_id = $1',
      [user_id]
    );

    const followerIds = result.rows.map((row: { follower_id: string }) => row.follower_id);

    callback(null, {
      follower_ids: followerIds,
    });
  } catch (error) {
    console.error('[UserHandler] getFollowers error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching followers',
    });
  }
}

export async function getFollowing(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { user_id } = call.request;

  try {
    if (!user_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'user_id is required',
      });
    }

    const result = await pool.query(
      'SELECT following_id FROM follows WHERE follower_id = $1',
      [user_id]
    );

    const followingIds = result.rows.map((row: { following_id: string }) => row.following_id);

    callback(null, {
      following_ids: followingIds,
    });
  } catch (error) {
    console.error('[UserHandler] getFollowing error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching following list',
    });
  }
}
