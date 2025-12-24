import { useState } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  leverage: number;
}

interface ManualPositionControlProps {
  positions: Position[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function ManualPositionControl({ positions, onClose, onRefresh }: ManualPositionControlProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showOpenPosition, setShowOpenPosition] = useState(false);
  const [newPosition, setNewPosition] = useState({
    symbol: 'BTC',
    side: 'long' as 'long' | 'short',
    size: 100,
    leverage: 3
  });

  const closePosition = async (symbol: string) => {
    setLoading(symbol);
    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
      } else {
        alert(data.message || 'Failed to close position');
      }
    } catch (error) {
      alert('Failed to close position: ' + error);
    }
    setLoading(null);
  };

  const closeAllPositions = async () => {
    setLoading('all');
    try {
      const response = await fetch('/api/positions/close-all', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        setShowEmergencyConfirm(false);
      } else {
        alert(data.message || 'Failed to close all positions');
      }
    } catch (error) {
      alert('Failed to close all positions: ' + error);
    }
    setLoading(null);
  };

  const openPosition = async () => {
    setLoading('open');
    try {
      const response = await fetch('/api/positions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPosition)
      });
      const data = await response.json();
      if (data.success) {
        onRefresh();
        setShowOpenPosition(false);
        setNewPosition({ symbol: 'BTC', side: 'long', size: 100, leverage: 3 });
      } else {
        alert(data.message || 'Failed to open position');
      }
    } catch (error) {
      alert('Failed to open position: ' + error);
    }
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold">Manual Position Control</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No open positions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((pos) => (
                <div key={pos.symbol} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold">{pos.symbol}</span>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          pos.side === 'long' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {pos.side === 'long' ? <TrendingUp className="w-3 h-3 inline mr-1" /> : <TrendingDown className="w-3 h-3 inline mr-1" />}
                          {pos.side.toUpperCase()} {pos.leverage}x
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-400">Entry Price:</span>
                          <span className="ml-2 font-semibold">${pos.entryPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Current Price:</span>
                          <span className="ml-2 font-semibold">${pos.currentPrice.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Size:</span>
                          <span className="ml-2 font-semibold">{pos.size.toFixed(4)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Unrealized P&L:</span>
                          <span className={`ml-2 font-semibold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnlPct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => closePosition(pos.symbol)}
                      disabled={loading === pos.symbol}
                      className="ml-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {loading === pos.symbol ? 'Closing...' : 'Close Position'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={() => setShowOpenPosition(true)}
              className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-semibold"
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Open New Position
            </button>

            <button
              onClick={() => setShowEmergencyConfirm(true)}
              disabled={positions.length === 0}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-semibold disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Emergency Close All
            </button>
          </div>
        </div>

        {showEmergencyConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-red-500/50 p-6 max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <h3 className="text-xl font-bold text-red-400">Emergency Close All</h3>
              </div>
              <p className="text-slate-300 mb-6">
                This will immediately close ALL {positions.length} open position{positions.length !== 1 ? 's' : ''} at market price. 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmergencyConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={closeAllPositions}
                  disabled={loading === 'all'}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading === 'all' ? 'Closing...' : 'Close All Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showOpenPosition && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-blue-500/50 p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Open New Position</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Symbol</label>
                  <select
                    value={newPosition.symbol}
                    onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                  >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="SOL">SOL</option>
                    <option value="HYPE">HYPE</option>
                    <option value="JUP">JUP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Side</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setNewPosition({ ...newPosition, side: 'long' })}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        newPosition.side === 'long'
                          ? 'bg-green-500/30 text-green-400 border-2 border-green-500'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      Long
                    </button>
                    <button
                      onClick={() => setNewPosition({ ...newPosition, side: 'short' })}
                      className={`px-4 py-2 rounded-lg font-semibold ${
                        newPosition.side === 'short'
                          ? 'bg-red-500/30 text-red-400 border-2 border-red-500'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      Short
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Size (USD)</label>
                  <input
                    type="number"
                    value={newPosition.size}
                    onChange={(e) => setNewPosition({ ...newPosition, size: parseFloat(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="10"
                    step="10"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Leverage</label>
                  <input
                    type="number"
                    value={newPosition.leverage}
                    onChange={(e) => setNewPosition({ ...newPosition, leverage: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2"
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowOpenPosition(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={openPosition}
                  disabled={loading === 'open'}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading === 'open' ? 'Opening...' : 'Open Position'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
