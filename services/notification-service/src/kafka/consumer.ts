import path from 'path';
import { Kafka, Consumer, logLevel, EachMessagePayload } from 'kafkajs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { sendNotification, broadcastToUsers, isUserOnline } from '../websocket/wsServer';

const kafka = new Kafka({
  clientId: 'notification-service-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

// gRPC User Service client for getting followers
const PROTO_PATH = path.join(__dirname, '../../../proto/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const userProto = protoDescriptor.user;

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'localhost:50051';
const userClient = new userProto.UserService(
  USER_SERVICE_URL,
  grpc.credentials.createInsecure()
);

function getFollowers(userId: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    userClient.getFollowers({ user_id: userId }, (error: grpc.ServiceError | null, response: any) => {
      if (error) {
        console.error(`[Notification Service] getFollowers error for user ${userId}:`, error.message);
        resolve([]); // Return empty array on error to not block notifications
        return;
      }
      resolve(response.follower_ids || []);
    });
  });
}

interface PostCreatedEvent {
  postId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

interface UserFollowedEvent {
  followerId: string;
  followerUsername: string;
  followingId: string;
  timestamp: number;
}

async function handlePostCreated(event: PostCreatedEvent): Promise<void> {
  const { postId, userId, username, content, timestamp } = event;

  // Get followers of the post author
  const followers = await getFollowers(userId);

  if (followers.length === 0) {
    return;
  }

  // Filter to only online followers
  const onlineFollowers = followers.filter((followerId) => isUserOnline(followerId));

  if (onlineFollowers.length === 0) {
    return;
  }

  const notification = {
    type: 'new_post',
    data: {
      postId,
      authorId: userId,
      authorUsername: username,
      contentPreview: content.length > 100 ? content.substring(0, 100) + '...' : content,
      timestamp,
    },
  };

  const delivered = broadcastToUsers(onlineFollowers, notification);
  console.log(`[Notification Service] Post ${postId} notification delivered to ${delivered}/${onlineFollowers.length} online followers`);
}

async function handleUserFollowed(event: UserFollowedEvent): Promise<void> {
  const { followerId, followerUsername, followingId, timestamp } = event;

  const notification = {
    type: 'new_follower',
    data: {
      followerId,
      followerUsername,
      timestamp,
    },
  };

  const delivered = sendNotification(followingId, notification);
  if (delivered) {
    console.log(`[Notification Service] Follow notification sent to user ${followingId}`);
  }
}

export async function startNotificationConsumer(): Promise<void> {
  const consumer: Consumer = kafka.consumer({
    groupId: 'notification-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await consumer.connect();
      console.log('[Notification Service] Kafka consumer connected');
      break;
    } catch (error) {
      attempt++;
      console.warn(`[Notification Service] Kafka connection attempt ${attempt}/${maxRetries} failed. Retrying in 3s...`);
      if (attempt >= maxRetries) {
        throw new Error(`Failed to connect Kafka consumer after ${maxRetries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  await consumer.subscribe({
    topics: ['post.created', 'user.followed'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      try {
        if (!message.value) {
          return;
        }

        const rawValue = message.value.toString();
        const event = JSON.parse(rawValue);

        if (topic === 'post.created') {
          await handlePostCreated(event as PostCreatedEvent);
        } else if (topic === 'user.followed') {
          await handleUserFollowed(event as UserFollowedEvent);
        }
      } catch (error) {
        console.error(`[Notification Service] Error processing message from topic ${topic}:`, error);
        // Don't rethrow — allow consumer to continue
      }
    },
  });

  const shutdown = async () => {
    try {
      await consumer.disconnect();
      console.log('[Notification Service] Kafka consumer disconnected');
    } catch (error) {
      console.error('[Notification Service] Error disconnecting consumer:', error);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
