import { Router, Request, Response } from 'express';
import { feedClient } from '../grpc/clients';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /feed — get the current user's feed (auth required)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
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

    const response = await feedClient.getFeed(userId, page, limit) as any;

    res.status(200).json({
      success: true,
      data: {
        items: response.items || [],
        has_more: response.has_more || false,
        page: response.page,
        limit: response.limit,
      },
    });
  } catch (error: any) {
    console.error('[API Gateway] GET /feed error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
