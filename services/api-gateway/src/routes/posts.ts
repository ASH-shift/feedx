import { Router, Request, Response } from 'express';
import { postClient } from '../grpc/clients';
import { authMiddleware } from '../middleware/auth';
import * as grpc from '@grpc/grpc-js';

const router = Router();

// POST /posts — create a new post (auth required)
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { content } = req.body;
    const userId = req.user!.id;
    const userEmail = req.user!.email;

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    // Get username from user service (stored in JWT email, but we need username)
    // We include username in the request; the gateway reads it from a separate user fetch
    // For efficiency, we accept username as optional body param or look it up
    // Here we pass the userId and look up user for username
    const { userClient } = await import('../grpc/clients');
    const userResponse = await userClient.getUser(userId) as any;
    const username = userResponse.username;

    const response = await postClient.createPost(userId, username, content.trim()) as any;

    res.status(201).json({
      success: true,
      data: {
        id: response.id,
        user_id: response.user_id,
        username: response.username,
        content: response.content,
        created_at: response.created_at,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.INVALID_ARGUMENT) {
      res.status(400).json({ success: false, error: grpcError.details || 'Invalid input' });
    } else {
      console.error('[API Gateway] POST /posts error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

// GET /posts/user/:userId — get posts by a specific user
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    if (isNaN(page) || page < 1) {
      res.status(400).json({ success: false, error: 'Invalid page parameter' });
      return;
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ success: false, error: 'limit must be between 1 and 100' });
      return;
    }

    const response = await postClient.getUserPosts(userId, page, limit) as any;

    res.status(200).json({
      success: true,
      data: {
        posts: response.posts,
        total: response.total,
        page: response.page,
        limit: response.limit,
      },
    });
  } catch (error: any) {
    console.error('[API Gateway] GET /posts/user/:userId error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /posts/:postId — get a single post
router.get('/:postId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    const response = await postClient.getPost(postId) as any;

    res.status(200).json({
      success: true,
      data: {
        id: response.id,
        user_id: response.user_id,
        username: response.username,
        content: response.content,
        created_at: response.created_at,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Post not found' });
    } else {
      console.error('[API Gateway] GET /posts/:postId error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

// DELETE /posts/:postId — delete a post (auth required)
router.delete('/:postId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = req.user!.id;

    const response = await postClient.deletePost(postId, userId) as any;

    res.status(200).json({
      success: true,
      data: {
        success: response.success,
        message: response.message,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Post not found' });
    } else if (grpcError.code === grpc.status.PERMISSION_DENIED) {
      res.status(403).json({ success: false, error: 'You do not have permission to delete this post' });
    } else {
      console.error('[API Gateway] DELETE /posts/:postId error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

export default router;
