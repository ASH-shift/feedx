import { createWebSocketServer } from './websocket/wsServer';
import { startNotificationConsumer } from './kafka/consumer';

async function main(): Promise<void> {
  console.log('[Notification Service] Starting...');

  const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);

  // Initialize WebSocket server
  const wss = createWebSocketServer(WS_PORT);

  // Start Kafka consumer for notifications
  try {
    await startNotificationConsumer();
    console.log('[Notification Service] Kafka consumer started');
  } catch (error) {
    console.error('[Notification Service] Failed to start Kafka consumer:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Notification Service] Shutting down...');
    wss.close((err) => {
      if (err) {
        console.error('[Notification Service] Error closing WebSocket server:', err);
        process.exit(1);
      }
      console.log('[Notification Service] WebSocket server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[Notification Service] Fatal error:', error);
  process.exit(1);
});
