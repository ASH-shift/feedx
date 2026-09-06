import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { startFeedConsumer } from './kafka/consumer';
import * as handlers from './handlers/feedHandlers';

const PROTO_PATH = path.join(__dirname, '../../proto/feed.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const feedProto = protoDescriptor.feed;

async function main(): Promise<void> {
  console.log('[Feed Service] Starting...');

  // Start Kafka consumer for feed fan-out
  try {
    await startFeedConsumer();
    console.log('[Feed Service] Kafka consumer started');
  } catch (error) {
    console.error('[Feed Service] Failed to start Kafka consumer:', error);
    process.exit(1);
  }

  // Create gRPC server
  const server = new grpc.Server({
    'grpc.max_send_message_length': 16 * 1024 * 1024,
    'grpc.max_receive_message_length': 16 * 1024 * 1024,
  });

  server.addService(feedProto.FeedService.service, {
    getFeed: handlers.getFeed,
  });

  const GRPC_PORT = process.env.GRPC_PORT || '50053';
  const bindAddress = `0.0.0.0:${GRPC_PORT}`;

  server.bindAsync(bindAddress, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('[Feed Service] Failed to bind server:', error);
      process.exit(1);
    }
    console.log(`[Feed Service] gRPC server listening on port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Feed Service] Shutting down...');
    server.tryShutdown((err) => {
      if (err) {
        console.error('[Feed Service] Error during shutdown:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[Feed Service] Fatal error:', error);
  process.exit(1);
});
