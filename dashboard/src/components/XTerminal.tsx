/**
 * XTerminal - Real terminal component using xterm.js
 * 
 * Connects to the backend terminal server via WebSocket
 * for full shell access (PowerShell/Bash).
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface XTerminalProps {
  wsUrl?: string;
  className?: string;
}

export default function XTerminal({ 
  wsUrl = import.meta.env.PROD
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/terminal`
    : 'ws://localhost:3002',
  className = ''
}: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#f5f5f5',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#3d3d5c',
        black: '#1a1a2e',
        red: '#ff6b6b',
        green: '#4ecdc4',
        yellow: '#ffe66d',
        blue: '#4dabf7',
        magenta: '#da77f2',
        cyan: '#63e6be',
        white: '#eaeaea',
        brightBlack: '#495057',
        brightRed: '#ff8787',
        brightGreen: '#69db7c',
        brightYellow: '#ffd43b',
        brightBlue: '#74c0fc',
        brightMagenta: '#e599f7',
        brightCyan: '#66d9e8',
        brightWhite: '#f8f9fa'
      },
      allowProposedApi: true
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Open terminal in container
    term.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    connectWebSocket(term, wsUrl);

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: dims.cols,
            rows: dims.rows
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Handle terminal input
    term.onData((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      wsRef.current?.close();
      term.dispose();
    };
  }, [wsUrl]);

  const connectWebSocket = (term: Terminal, url: string) => {
    setError(null);
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      term.writeln('\x1b[32mConnected to terminal server\x1b[0m');
      term.writeln('');
      
      // Send initial resize
      if (fitAddonRef.current) {
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: dims.cols,
            rows: dims.rows
          }));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'output':
            term.write(msg.data);
            break;
          case 'session':
            setSessionId(msg.id);
            break;
          case 'exit':
            term.writeln(`\r\n\x1b[33mSession ended (code: ${msg.code})\x1b[0m`);
            setIsConnected(false);
            break;
          case 'pong':
            // Heartbeat response
            break;
        }
      } catch (e) {
        // Raw data, just write it
        term.write(event.data);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      term.writeln('\r\n\x1b[31mDisconnected from terminal server\x1b[0m');
    };

    ws.onerror = () => {
      setError('Failed to connect to terminal server');
      term.writeln('\r\n\x1b[31mConnection error - terminal server may not be running\x1b[0m');
      term.writeln('\x1b[33mStart the bot backend to enable terminal access\x1b[0m');
    };
  };

  const handleReconnect = () => {
    if (termRef.current) {
      termRef.current.clear();
      connectWebSocket(termRef.current, wsUrl);
    }
  };

  return (
    <div className={`bg-[#1a1a2e] rounded-lg border border-gray-700 flex flex-col ${className}`}>
      {/* Terminal Header */}
      <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="ml-2 text-gray-400 text-xs font-mono">
            Terminal {sessionId ? `(${sessionId.slice(0, 12)}...)` : ''}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {error && (
            <button
              onClick={handleReconnect}
              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white"
            >
              Reconnect
            </button>
          )}
          <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={terminalRef}
        className="flex-1 p-2"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
