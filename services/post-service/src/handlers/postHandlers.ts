import * as grpc from '@grpc/grpc-js';
import { pool } from '../db/client';
import { publishEvent } from '../kafka/producer';

export async function createPost(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { user_id, username, content } = call.request;

  try {
    if (!user_id || !username || !content) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'user_id, username, and content are required',
      });
    }

    if (content.trim().length === 0) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'content cannot be empty',
      });
    }

    if (content.length > 280) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'content must be 280 characters or fewer',
      });
    }

    const result = await pool.query(
      'INSERT INTO posts (user_id, username, content) VALUES ($1, $2, $3) RETURNING id, user_id, username, content, created_at',
      [user_id, username, content.trim()]
    );

    const post = result.rows[0];
    const timestamp = post.created_at.getTime();

    await publishEvent('post.created', {
      postId: post.id,
      userId: post.user_id,
      username: post.username,
      content: post.content,
      timestamp,
    });

    callback(null, {
      id: post.id,
      user_id: post.user_id,
      username: post.username,
      content: post.content,
      created_at: timestamp,
    });
  } catch (error) {
    console.error('[PostHandler] createPost error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while creating post',
    });
  }
}

export async function getPost(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { post_id } = call.request;

  try {
    if (!post_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'post_id is required',
      });
    }

    const result = await pool.query(
      'SELECT id, user_id, username, content, created_at FROM posts WHERE id = $1',
      [post_id]
    );

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Post with id ${post_id} not found`,
      });
    }

    const post = result.rows[0];

    callback(null, {
      id: post.id,
      user_id: post.user_id,
      username: post.username,
      content: post.content,
      created_at: post.created_at.getTime(),
    });
  } catch (error) {
    console.error('[PostHandler] getPost error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching post',
    });
  }
}

export async function getUserPosts(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { user_id, page = 1, limit = 20 } = call.request;

  try {
    if (!user_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'user_id is required',
      });
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE user_id = $1',
      [user_id]
    );

    const postsResult = await pool.query(
      'SELECT id, user_id, username, content, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [user_id, safeLimit, offset]
    );

    const posts = postsResult.rows.map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      username: post.username,
      content: post.content,
      created_at: post.created_at.getTime(),
    }));

    callback(null, {
      posts,
      total: parseInt(countResult.rows[0].count, 10),
      page: safePage,
      limit: safeLimit,
    });
  } catch (error) {
    console.error('[PostHandler] getUserPosts error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching user posts',
    });
  }
}

export async function deletePost(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  const { post_id, user_id } = call.request;

  try {
    if (!post_id || !user_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'post_id and user_id are required',
      });
    }

    const existingPost = await pool.query(
      'SELECT id FROM posts WHERE id = $1',
      [post_id]
    );

    if (existingPost.rows.length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Post with id ${post_id} not found`,
      });
    }

    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [post_id, user_id]
    );

    if (result.rows.length === 0) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'You do not have permission to delete this post',
      });
    }

    await publishEvent('post.deleted', {
      postId: post_id,
      userId: user_id,
      timestamp: Date.now(),
    });

    callback(null, {
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('[PostHandler] deletePost error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while deleting post',
    });
  }
}
