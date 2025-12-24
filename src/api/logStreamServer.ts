/**
 * Log Stream Server - Broadcasts bot logs to dashboard clients
 * 
 * Simple WebSocket server that allows the dashboard to receive
 * log messages pushed from various parts of the bot.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

interface LogMessage {
  timestamp: number;
  level: string;
  message: string;
  meta?: any;
}

const connectedClients: Set<WebSocket> = new Set();
const logBuffer: LogMessage[] = [];
const MAX_BUFFER_SIZE = 500;

let wss: WebSocketServer | null = null;
let lastBroadcastTime: number = 0;
let lastBroadcastMessage: string = '';

/**
 * Broadcast log message to all connected clients
 * Includes deduplication to prevent duplicate messages within 100ms
 */
function broadcast(logMessage: LogMessage): void {
  const payload = JSON.stringify({ type: 'log', data: logMessage });
  const now = Date.now();
  
  // Deduplicate identical messages within 100ms window
  if (payload === lastBroadcastMessage && (now - lastBroadcastTime) < 100) {
    return;
  }
  lastBroadcastTime = now;
  lastBroadcastMessage = payload;
  
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (error) {
        // Silent fail - don't log errors about logging
      }
    }
  });
}

/**
 * Initialize the log stream WebSocket server
 */
export function initLogStreamServer(port: number = 3003): WebSocketServer {
  if (wss) {
    logger.warn('Log stream server already initialized');
    return wss;
  }

  wss = new WebSocketServer({ port });

  logger.info(`Log Stream WebSocket server started on ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    connectedClients.add(ws);
    
    // Only log if this is the first client (reduce noise)
    if (connectedClients.size === 1) {
      logger.info('Dashboard connected to log stream');
    }

    // Send connection acknowledgment
    ws.send(JSON.stringify({ 
      type: 'connected',
      message: 'Connected to log stream'
    }));

    // Send buffered logs
    ws.send(JSON.stringify({
      type: 'history',
      data: logBuffer
    }));

    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          
          case 'clear':
            // Clear log buffer for this client
            logBuffer.length = 0;
            ws.send(JSON.stringify({ type: 'cleared' }));
            break;

          default:
            logger.warn(`Unknown log stream message type: ${msg.type}`);
        }
      } catch (error) {
        logger.error('Error processing log stream message:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      // Only log if all clients disconnected
      if (connectedClients.size === 0) {
        logger.info('Dashboard disconnected from log stream');
      }
    });

    ws.on('error', (error: Error) => {
      logger.error('Log stream client error:', error);
      connectedClients.delete(ws);
    });
  });

  wss.on('error', (error: Error) => {
    logger.error('Log stream WebSocket server error:', error);
  });

  return wss;
}

/**
 * Get current log buffer
 */
export function getLogBuffer(): LogMessage[] {
  return [...logBuffer];
}

/**
 * Clear log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
  return connectedClients.size;
}

/**
 * Shutdown the log stream server
 */
export function shutdownLogStreamServer(): void {
  connectedClients.forEach(client => {
    client.close();
  });
  connectedClients.clear();

  if (wss) {
    wss.close();
    wss = null;
    logger.info('Log stream WebSocket server shut down');
  }
}

/**
 * Manually push a log message (for custom integrations)
 */
export function pushLog(level: string, message: string, meta?: any): void {
  const logMessage: LogMessage = {
    timestamp: Date.now(),
    level,
    message,
    meta
  };

  logBuffer.push(logMessage);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  broadcast(logMessage);
}

export default {
  initLogStreamServer,
  shutdownLogStreamServer,
  getLogBuffer,
  clearLogBuffer,
  getClientCount,
  pushLog
};
