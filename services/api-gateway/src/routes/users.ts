import { Router, Request, Response } from 'express';
import { userClient } from '../grpc/clients';
import { authMiddleware } from '../middleware/auth';
import * as grpc from '@grpc/grpc-js';

const router = Router();

// GET /users/:userId — get user profile
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const response = await userClient.getUser(userId) as any;

    res.status(200).json({
      success: true,
      data: {
        id: response.id,
        username: response.username,
        email: response.email,
        followers_count: response.followers_count,
        following_count: response.following_count,
        created_at: response.created_at,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.NOT_FOUND) {
      res.status(404).json({ success: false, error: 'User not found' });
    } else {
      console.error('[API Gateway] GET /users/:userId error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

// POST /users/:userId/follow — follow a user (auth required)
router.post('/:userId/follow', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user!.id;

    if (followerId === followingId) {
      res.status(400).json({ success: false, error: 'You cannot follow yourself' });
      return;
    }

    const response = await userClient.followUser(followerId, followingId) as any;

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
      res.status(404).json({ success: false, error: 'User not found' });
    } else if (grpcError.code === grpc.status.INVALID_ARGUMENT) {
      res.status(400).json({ success: false, error: grpcError.details || 'Invalid request' });
    } else {
      console.error('[API Gateway] POST /users/:userId/follow error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

// DELETE /users/:userId/follow — unfollow a user (auth required)
router.delete('/:userId/follow', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: followingId } = req.params;
    const followerId = req.user!.id;

    const response = await userClient.unfollowUser(followerId, followingId) as any;

    res.status(200).json({
      success: true,
      data: {
        success: response.success,
        message: response.message,
      },
    });
  } catch (error: any) {
    console.error('[API Gateway] DELETE /users/:userId/follow error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /users/:userId/followers — get user's followers
router.get('/:userId/followers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const response = await userClient.getFollowers(userId) as any;

    res.status(200).json({
      success: true,
      data: {
        follower_ids: response.follower_ids,
        count: response.follower_ids.length,
      },
    });
  } catch (error: any) {
    console.error('[API Gateway] GET /users/:userId/followers error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /users/:userId/following — get who the user is following
router.get('/:userId/following', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const response = await userClient.getFollowing(userId) as any;

    res.status(200).json({
      success: true,
      data: {
        following_ids: response.following_ids,
        count: response.following_ids.length,
      },
    });
  } catch (error: any) {
    console.error('[API Gateway] GET /users/:userId/following error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
