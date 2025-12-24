/**
 * BotLogs - Real-time bot log viewer
 * 
 * Displays all backend terminal output in the dashboard
 * including trades, decisions, diagnostics, and system events.
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal, AlertCircle, Trash2, Download } from 'lucide-react';

interface LogMessage {
  timestamp: number;
  level: string;
  message: string;
  meta?: any;
}

interface BotLogsProps {
  wsUrl?: string;
  className?: string;
  maxLogs?: number;
}

export default function BotLogs({ 
  wsUrl = import.meta.env.PROD 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/logs`
    : 'ws://localhost:3003',
  className = '',
  maxLogs = 500
}: BotLogsProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const connectWebSocket = () => {
    setError(null);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'connected':
            break;
            
          case 'history':
            setLogs(msg.data);
            break;
            
          case 'log':
            setLogs(prev => {
              const updated = [...prev, msg.data];
              if (updated.length > maxLogs) {
                return updated.slice(-maxLogs);
              }
              return updated;
            });
            break;
            
          case 'cleared':
            setLogs([]);
            break;
            
          case 'pong':
            break;
        }
      } catch (e) {
        console.error('Failed to parse log stream message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(() => connectWebSocket(), 3000);
    };

    ws.onerror = () => {
      setError('Failed to connect to log stream');
      setIsConnected(false);
    };
  };

  const handleClear = () => {
    setLogs([]);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear' }));
    }
  };

  const handleDownload = () => {
    const logText = logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const meta = log.meta ? ` ${JSON.stringify(log.meta)}` : '';
      return `[${timestamp}] ${log.level.toUpperCase()}: ${log.message}${meta}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const getLogColor = (level: string): string => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      case 'debug':
        return 'text-gray-400';
      default:
        return 'text-slate-300';
    }
  };

  const getLogIcon = (level: string): string => {
    switch (level) {
      case 'error':
        return '[ERR]';
      case 'warn':
        return '[WRN]';
      case 'info':
        return '[INF]';
      case 'debug':
        return '[DBG]';
      default:
        return '[---]';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold">Bot Diagnostics</span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{logs.length} logs</span>
          
          <button
            onClick={handleDownload}
            disabled={logs.length === 0}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && !isConnected && (
        <div className="p-3 bg-red-900/20 border-b border-red-700/30 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error} - Reconnecting...
        </div>
      )}

      {/* Logs Container */}
      <div 
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 font-mono text-xs space-y-0.5"
        style={{ minHeight: '200px', maxHeight: '600px' }}
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 text-center py-8">
            No logs yet. Waiting for bot activity...
          </div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index}
              className="flex items-start gap-2 hover:bg-slate-700/30 px-2 py-1 rounded"
            >
              <span className="text-slate-500 shrink-0">
                {formatTimestamp(log.timestamp)}
              </span>
              
              <span className={`shrink-0 ${getLogColor(log.level)}`}>
                {getLogIcon(log.level)}
              </span>
              
              <span className={`flex-1 ${getLogColor(log.level)}`}>
                {log.message}
              </span>
              
              {log.meta && Object.keys(log.meta).length > 0 && (
                <span className="text-slate-500 text-xs">
                  {JSON.stringify(log.meta)}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
