import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { runMigrations } from './db/migrations';
import { initProducer } from './kafka/producer';
import * as handlers from './handlers/userHandlers';

const PROTO_PATH = path.join(__dirname, '../../proto/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const userProto = protoDescriptor.user;

async function main(): Promise<void> {
  console.log('[User Service] Starting...');

  // Run database migrations
  let migrationAttempts = 0;
  const maxMigrationAttempts = 10;
  while (migrationAttempts < maxMigrationAttempts) {
    try {
      await runMigrations();
      break;
    } catch (error) {
      migrationAttempts++;
      console.warn(`[User Service] Migration attempt ${migrationAttempts}/${maxMigrationAttempts} failed. Retrying in 3s...`);
      if (migrationAttempts >= maxMigrationAttempts) {
        console.error('[User Service] Failed to run migrations. Exiting.');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Initialize Kafka producer
  try {
    await initProducer();
  } catch (error) {
    console.error('[User Service] Failed to initialize Kafka producer:', error);
    process.exit(1);
  }

  // Create gRPC server
  const server = new grpc.Server({
    'grpc.max_send_message_length': 16 * 1024 * 1024,
    'grpc.max_receive_message_length': 16 * 1024 * 1024,
  });

  server.addService(userProto.UserService.service, {
    register: handlers.register,
    login: handlers.login,
    getUser: handlers.getUser,
    followUser: handlers.followUser,
    unfollowUser: handlers.unfollowUser,
    getFollowers: handlers.getFollowers,
    getFollowing: handlers.getFollowing,
  });

  const GRPC_PORT = process.env.GRPC_PORT || '50051';
  const bindAddress = `0.0.0.0:${GRPC_PORT}`;

  server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('[User Service] Failed to bind server:', error);
      process.exit(1);
    }
    console.log(`[User Service] gRPC server listening on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[User Service] Shutting down...');
    server.tryShutdown((err) => {
      if (err) {
        console.error('[User Service] Error during shutdown:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[User Service] Fatal error:', error);
  process.exit(1);
});
