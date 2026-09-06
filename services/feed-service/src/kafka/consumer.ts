import { Kafka, Consumer, logLevel, EachMessagePayload } from 'kafkajs';
import { redis } from '../redis/client';
import { getFollowers } from '../grpc/userClient';

const kafka = new Kafka({
  clientId: 'feed-service-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const FEED_MAX_SIZE = 1000;

interface PostCreatedEvent {
  postId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

async function fanOutPost(event: PostCreatedEvent): Promise<void> {
  const { postId, userId, username, content, timestamp } = event;

  const serializedPost = JSON.stringify({ postId, userId, username, content, timestamp });

  // Fan-out: add to each follower's feed
  let followers: string[] = [];
  try {
    followers = await getFollowers(userId);
  } catch (error) {
    console.error(`[Feed Service] Failed to get followers for user ${userId}:`, error);
    // Continue to add to author's own feed even if followers fetch fails
  }

  // Also add to the author's own feed/timeline
  const recipientIds = new Set([...followers, userId]);

  const pipeline = redis.pipeline();

  for (const recipientId of recipientIds) {
    const feedKey = `feed:${recipientId}`;
    // ZADD with score = Unix timestamp in milliseconds
    pipeline.zadd(feedKey, timestamp, serializedPost);
    // Keep only the last FEED_MAX_SIZE items (trim oldest)
    pipeline.zremrangebyrank(feedKey, 0, -(FEED_MAX_SIZE + 1));
    // Set TTL to 7 days to prevent stale data
    pipeline.expire(feedKey, 7 * 24 * 60 * 60);
  }

  await pipeline.exec();

  console.log(`[Feed Service] Fan-out complete for post ${postId} to ${recipientIds.size} feeds`);
}

export async function startFeedConsumer(): Promise<void> {
  const consumer: Consumer = kafka.consumer({
    groupId: 'feed-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await consumer.connect();
      console.log('[Feed Service] Kafka consumer connected');
      break;
    } catch (error) {
      attempt++;
      console.warn(`[Feed Service] Kafka consumer connection attempt ${attempt}/${maxRetries} failed. Retrying in 3s...`);
      if (attempt >= maxRetries) {
        throw new Error(`Failed to connect Kafka consumer after ${maxRetries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  await consumer.subscribe({
    topics: ['post.created'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        if (!message.value) {
          console.warn('[Feed Service] Received message with null value, skipping');
          return;
        }

        const rawValue = message.value.toString();
        const event = JSON.parse(rawValue) as PostCreatedEvent;

        if (topic === 'post.created') {
          await fanOutPost(event);
        }
      } catch (error) {
        console.error(`[Feed Service] Error processing message from topic ${topic}:`, error);
        // Don't rethrow — allow consumer to continue processing next messages
      }
    },
  });

  // Graceful shutdown handler
  const shutdown = async () => {
    try {
      await consumer.disconnect();
      console.log('[Feed Service] Kafka consumer disconnected');
    } catch (error) {
      console.error('[Feed Service] Error disconnecting consumer:', error);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
