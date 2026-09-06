import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

// Map of userId -> WebSocket connection
const connections = new Map<string, WebSocket>();

let wss: WebSocketServer;

interface AuthMessage {
  type: 'auth';
  userId: string;
}

interface PingMessage {
  type: 'ping';
}

type ClientMessage = AuthMessage | PingMessage;

export function createWebSocketServer(port: number): WebSocketServer {
  wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`[Notification Service] WebSocket server listening on port ${port}`);
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[Notification Service] New WebSocket connection from ${clientIp}`);

    let authenticatedUserId: string | null = null;
    let pingInterval: NodeJS.Timeout;

    // Send connection acknowledgement
    ws.send(JSON.stringify({ type: 'connected', message: 'Please authenticate with { type: "auth", userId: "<your-user-id>" }' }));

    // Heartbeat to detect broken connections
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', (rawData: WebSocket.Data) => {
      try {
        const message = JSON.parse(rawData.toString()) as ClientMessage;

        if (message.type === 'auth') {
          const { userId } = message as AuthMessage;

          if (!userId || typeof userId !== 'string') {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid userId in auth message' }));
            return;
          }

          // Remove previous connection if user reconnects
          if (connections.has(userId)) {
            const oldWs = connections.get(userId);
            if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
              oldWs.send(JSON.stringify({ type: 'disconnected', message: 'New connection established from another client' }));
              oldWs.close();
            }
          }

          authenticatedUserId = userId;
          connections.set(userId, ws);

          ws.send(JSON.stringify({ type: 'authenticated', userId, message: 'Successfully authenticated' }));
          console.log(`[Notification Service] User ${userId} authenticated via WebSocket`);
        } else if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (error) {
        console.error('[Notification Service] Failed to parse WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format. Expected JSON.' }));
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      clearInterval(pingInterval);
      if (authenticatedUserId) {
        const existingConn = connections.get(authenticatedUserId);
        // Only remove if this is still the current connection for this user
        if (existingConn === ws) {
          connections.delete(authenticatedUserId);
          console.log(`[Notification Service] User ${authenticatedUserId} disconnected (code: ${code})`);
        }
      }
    });

    ws.on('error', (error: Error) => {
      console.error('[Notification Service] WebSocket error:', error.message);
      clearInterval(pingInterval);
      if (authenticatedUserId) {
        const existingConn = connections.get(authenticatedUserId);
        if (existingConn === ws) {
          connections.delete(authenticatedUserId);
        }
      }
    });
  });

  wss.on('error', (error: Error) => {
    console.error('[Notification Service] WebSocket server error:', error);
  });

  return wss;
}

export function sendNotification(userId: string, payload: object): boolean {
  const ws = connections.get(userId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error(`[Notification Service] Failed to send notification to user ${userId}:`, error);
    connections.delete(userId);
    return false;
  }
}

export function getOnlineUsers(): string[] {
  return Array.from(connections.keys());
}

export function isUserOnline(userId: string): boolean {
  const ws = connections.get(userId);
  return ws !== undefined && ws.readyState === WebSocket.OPEN;
}

export function broadcastToUsers(userIds: string[], payload: object): number {
  let successCount = 0;
  for (const userId of userIds) {
    if (sendNotification(userId, payload)) {
      successCount++;
    }
  }
  return successCount;
}
