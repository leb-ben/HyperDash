/**
 * Terminal Server - Shell access via WebSocket
 * 
 * Uses child_process to spawn shell processes and communicates
 * with the frontend xterm.js terminal via WebSocket.
 * 
 * Note: This is a fallback implementation that works without
 * native node-pty compilation. For full PTY support, install
 * node-pty with proper build tools.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { logger } from '../utils/logger.js';
import os from 'os';
import path from 'path';

// Determine shell based on OS
const isWindows = os.platform() === 'win32';
const shell = isWindows ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
const shellArgs = isWindows ? ['-NoLogo', '-NoExit', '-Command', '-'] : ['-i'];

interface TerminalSession {
  id: string;
  process: ChildProcessWithoutNullStreams;
  ws: WebSocket;
  createdAt: number;
  inputBuffer: string;
}

const sessions: Map<string, TerminalSession> = new Map();

let wss: WebSocketServer | null = null;

/**
 * Initialize the terminal WebSocket server
 */
export function initTerminalServer(port: number = 3002): WebSocketServer {
  if (wss) {
    logger.warn('Terminal server already initialized');
    return wss;
  }

  wss = new WebSocketServer({ port });

  logger.info(`Terminal WebSocket server started on ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    const sessionId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    logger.info(`New terminal session: ${sessionId}`);

    // Get the project root directory
    const projectRoot = path.resolve(process.cwd());

    // Spawn shell process
    const shellProcess = spawn(shell, isWindows ? ['-NoLogo', '-NoExit'] : ['-i'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        PATH: `${path.join(projectRoot, 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`
      },
      shell: false,
      windowsHide: true
    });

    const session: TerminalSession = {
      id: sessionId,
      process: shellProcess,
      ws,
      createdAt: Date.now(),
      inputBuffer: ''
    };

    sessions.set(sessionId, session);

    // Send session ID and welcome message
    ws.send(JSON.stringify({ type: 'session', id: sessionId }));
    
    // Send welcome message
    const welcomeMsg = isWindows 
      ? '\x1b[32mPowerShell Terminal Connected\x1b[0m\r\n'
      : '\x1b[32mBash Terminal Connected\x1b[0m\r\n';
    ws.send(JSON.stringify({ type: 'output', data: welcomeMsg }));

    // Forward stdout to WebSocket
    shellProcess.stdout.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
      }
    });

    // Forward stderr to WebSocket
    shellProcess.stderr.on('data', (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: `\x1b[31m${data.toString()}\x1b[0m` }));
      }
    });

    // Handle process exit
    shellProcess.on('exit', (code: number | null, signal: string | null) => {
      logger.info(`Terminal session ${sessionId} exited with code ${code}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: code || 0, signal }));
      }
      sessions.delete(sessionId);
    });

    shellProcess.on('error', (error: Error) => {
      logger.error(`Terminal process error: ${error.message}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data: `\x1b[31mError: ${error.message}\x1b[0m\r\n` }));
      }
    });

    // Handle incoming messages from WebSocket
    ws.on('message', (message: Buffer) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.type) {
          case 'input':
            // Send input to shell stdin
            if (shellProcess.stdin.writable) {
              shellProcess.stdin.write(msg.data);
            }
            break;

          case 'resize':
            // Note: resize not supported without PTY
            // Could implement partial support with stty on Unix
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            logger.warn(`Unknown terminal message type: ${msg.type}`);
        }
      } catch (error) {
        logger.error('Error processing terminal message:', error);
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      logger.info(`Terminal session ${sessionId} closed`);
      shellProcess.kill();
      sessions.delete(sessionId);
    });

    // Handle WebSocket error
    ws.on('error', (error: Error) => {
      logger.error(`Terminal session ${sessionId} error:`, error);
      shellProcess.kill();
      sessions.delete(sessionId);
    });
  });

  wss.on('error', (error: Error) => {
    logger.error('Terminal WebSocket server error:', error);
  });

  return wss;
}

/**
 * Get all active terminal sessions
 */
export function getActiveSessions(): { id: string; createdAt: number }[] {
  return Array.from(sessions.values()).map(s => ({
    id: s.id,
    createdAt: s.createdAt
  }));
}

/**
 * Kill a specific terminal session
 */
export function killSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    session.process.kill();
    session.ws.close();
    sessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Shutdown the terminal server
 */
export function shutdownTerminalServer(): void {
  // Kill all sessions
  for (const session of sessions.values()) {
    session.process.kill();
    session.ws.close();
  }
  sessions.clear();

  // Close WebSocket server
  if (wss) {
    wss.close();
    wss = null;
    logger.info('Terminal WebSocket server shut down');
  }
}

/**
 * Execute a command and return output
 * Useful for AI agent to execute commands programmatically
 */
export async function executeCommand(command: string, timeout: number = 30000): Promise<{
  output: string;
  exitCode: number;
}> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(process.cwd());
    
    const args = isWindows 
      ? ['-NoLogo', '-NoProfile', '-Command', command]
      : ['-c', command];

    const proc = spawn(shell, args, {
      cwd: projectRoot,
      env: process.env,
      shell: false
    });

    let output = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.on('exit', (code: number | null) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ output, exitCode: code || 0 });
      }
    });

    proc.on('error', (error: Error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  });
}

/**
 * Execute a bot-specific command (convenience wrapper)
 */
export async function executeBotCommand(cmd: string): Promise<string> {
  const projectRoot = path.resolve(process.cwd());
  
  // Map simple commands to npm scripts or direct commands
  const commandMap: Record<string, string> = {
    'bot start': 'npm run start',
    'bot stop': 'taskkill /f /im node.exe', // Windows specific
    'bot status': 'echo Bot status check',
    'npm test': 'npm test',
    'npm build': 'npm run build',
    'npm check': 'npm run check'
  };

  const actualCmd = commandMap[cmd] || cmd;
  
  try {
    const result = await executeCommand(actualCmd, 60000);
    return result.output;
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}

export default {
  initTerminalServer,
  getActiveSessions,
  killSession,
  shutdownTerminalServer,
  executeCommand,
  executeBotCommand
};
