import * as grpc from '@grpc/grpc-js';
import { redis } from '../redis/client';

interface FeedItem {
  postId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export async function getFeed(
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

    const feedKey = `feed:${user_id}`;

    // ZREVRANGEBYSCORE to get items in reverse chronological order (newest first)
    // Score is Unix timestamp in milliseconds, so newest = highest score
    const rawItems = await redis.zrevrangebyscore(
      feedKey,
      '+inf',
      '-inf',
      'LIMIT',
      offset,
      safeLimit
    );

    const feedItems = rawItems
      .map((rawItem: string) => {
        try {
          const parsed = JSON.parse(rawItem) as FeedItem;
          return {
            post_id: parsed.postId,
            user_id: parsed.userId,
            username: parsed.username,
            content: parsed.content,
            created_at: parsed.timestamp,
          };
        } catch (parseError) {
          console.warn('[Feed Handler] Failed to parse feed item:', rawItem, parseError);
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    callback(null, {
      items: feedItems,
      page: safePage,
      limit: safeLimit,
    });
  } catch (error) {
    console.error('[FeedHandler] getFeed error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error while fetching feed',
    });
  }
}
