import { useState, useEffect, useRef, KeyboardEvent } from 'react';

interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  type: 'command' | 'system' | 'error' | 'success';
}

interface CommandHistory {
  commands: string[];
  index: number;
}

export default function Terminal() {
  const [commands, setCommands] = useState<TerminalCommand[]>([
    {
      id: '1',
      command: '',
      output: '🤖 AI Trading Bot Terminal v1.0\nType "help" for available commands',
      timestamp: new Date(),
      type: 'system'
    }
  ]);
  
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandHistory>({
    commands: [],
    index: -1
  });
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commands]);

  // Focus input when terminal is clicked
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  // Execute command
  const executeCommand = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;

    // Add command to history
    setCommands(prev => [...prev, {
      id: Date.now().toString(),
      command: trimmedCmd,
      output: '',
      timestamp: new Date(),
      type: 'command'
    }]);

    // Add to command history
    setCommandHistory(prev => ({
      commands: [...prev.commands, trimmedCmd],
      index: prev.commands.length
    }));

    setIsProcessing(true);

    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmedCmd })
      });

      const result = await response.json();

      setCommands(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        command: '',
        output: result.output || 'Command executed',
        timestamp: new Date(),
        type: result.success ? 'success' : 'error'
      }]);

    } catch (error) {
      setCommands(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        command: '',
        output: `Error: ${error}`,
        timestamp: new Date(),
        type: 'error'
      }]);
    }

    setIsProcessing(false);
  };

  // Handle keyboard input
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.index > 0) {
        const newIndex = commandHistory.index - 1;
        setCurrentInput(commandHistory.commands[newIndex]);
        setCommandHistory(prev => ({ ...prev, index: newIndex }));
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.index < commandHistory.commands.length - 1) {
        const newIndex = commandHistory.index + 1;
        setCurrentInput(commandHistory.commands[newIndex]);
        setCommandHistory(prev => ({ ...prev, index: newIndex }));
      } else if (commandHistory.index === commandHistory.commands.length - 1) {
        setCurrentInput('');
        setCommandHistory(prev => ({ ...prev, index: prev.commands.length }));
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion for common commands
      const commonCommands = ['help', 'bot.start', 'bot.stop', 'bot.status', 'portfolio.show', 'prices.get', 'signals.list'];
      const match = commonCommands.find(cmd => cmd.startsWith(currentInput));
      if (match) {
        setCurrentInput(match);
      }
    }
  };

  // Get output color based on type
  const getOutputColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'system': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="bg-black rounded-lg border border-gray-700 h-96 flex flex-col font-mono text-sm">
      {/* Terminal Header */}
      <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="ml-2 text-gray-400 text-xs">Terminal</span>
        </div>
        <div className="text-gray-500 text-xs">
          {isProcessing ? '⚡ Processing...' : '✓ Ready'}
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4"
        onClick={handleTerminalClick}
      >
        {commands.map((cmd) => (
          <div key={cmd.id} className="mb-2">
            {cmd.command && (
              <div className="text-green-400">
                $ {cmd.command}
              </div>
            )}
            {cmd.output && (
              <div className={`${getOutputColor(cmd.type)} whitespace-pre-wrap ml-4`}>
                {cmd.output}
              </div>
            )}
            <div className="text-gray-600 text-xs ml-4">
              {cmd.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {/* Terminal Input */}
      <div className="border-t border-gray-700 p-2 flex items-center">
        <span className="text-green-400 mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-gray-300 outline-none"
          placeholder="Type command... (Tab for autocomplete)"
          disabled={isProcessing}
        />
      </div>
    </div>
  );
}
