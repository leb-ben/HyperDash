/**
 * HTML for the Backtest GUI
 */

export function getBacktestHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hamburger Bot Backtesting</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e4e4e7; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: #a1a1aa; margin-bottom: 32px; font-size: 1.1rem; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2); }
    .card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; color: #f4f4f5; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .form-group { display: flex; flex-direction: column; }
    .form-label { font-size: 0.875rem; font-weight: 500; color: #d4d4d8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.025em; }
    .form-input, .form-select { padding: 10px 14px; border: 1px solid #3f3f46; border-radius: 8px; font-size: 0.875rem; background: #18181b; color: #f4f4f5; transition: all 0.15s ease; width: 100%; box-shadow: inset 0 1px 2px rgba(0,0,0,0.2); }
    .form-input:focus, .form-select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); background: #202023; }
    .form-input:hover, .form-select:hover { border-color: #52525b; }
    .form-input[type="date"] { color-scheme: dark; }
    .form-input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
    .btn { padding: 10px 20px; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 8px; border: none; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); }
    .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); transform: translateY(-1px); box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.4); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .btn-secondary { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; }
    .btn-secondary:hover { background: #2f2f31; border-color: #52525b; transform: translateY(-1px); }
    .progress-bar { width: 100%; height: 6px; background: #27272a; border-radius: 3px; overflow: hidden; margin-top: 12px; border: 1px solid #3f3f46; position: relative; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); transition: width 0.3s ease; border-radius: 2px; }
    
    /* DNA Progress Bar Styles */
    .dna-container {
      width: 100%;
      height: 140px;
      position: relative;
      margin-top: 32px;
      overflow: hidden;
      background: #09090b;
      border-radius: 16px;
      border: 1px solid #27272a;
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 2000px;
      box-shadow: inset 0 0 30px rgba(0,0,0,0.7);
    }
    .dna-strand {
      display: flex;
      gap: 20px;
      padding: 0 40px;
      transform-style: preserve-3d;
    }
    .dna-pair {
      position: relative;
      width: 16px;
      height: 100px;
      transform-style: preserve-3d;
    }
    .dna-node {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      position: absolute;
      left: 50%;
      margin-left: -7px;
      transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 2;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .node-top {
      top: 0;
      background: #3f3f46;
      animation: dna-twist 4s infinite ease-in-out;
    }
    .node-bottom {
      bottom: 0;
      background: #27272a;
      animation: dna-twist-reverse 4s infinite ease-in-out;
    }
    .dna-node.active {
      background: #3b82f6;
      box-shadow: 0 0 20px #3b82f6, 0 0 40px rgba(59, 130, 246, 0.6);
      border-color: rgba(255, 255, 255, 0.4);
    }
    .dna-node.active-pair {
      background: #8b5cf6;
      box-shadow: 0 0 20px #8b5cf6, 0 0 40px rgba(139, 92, 246, 0.6);
      border-color: rgba(255, 255, 255, 0.4);
    }
    .dna-connection {
      position: absolute;
      width: 2px;
      height: 100%;
      left: 50%;
      margin-left: -1px;
      background: rgba(255, 255, 255, 0.05);
      transition: all 0.8s ease;
      z-index: 1;
      transform-origin: center;
      animation: dna-conn-fade 4s infinite ease-in-out;
    }
    .dna-connection.active {
      background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
      opacity: 0.9;
    }
    @keyframes dna-twist {
      0%, 100% { transform: translateY(0) translateZ(-60px) rotateY(0deg) scale(0.5); opacity: 0.2; filter: blur(4px); }
      25% { transform: translateY(30px) translateZ(0) rotateY(90deg) scale(1); opacity: 1; filter: blur(0px); }
      50% { transform: translateY(0) translateZ(60px) rotateY(180deg) scale(1.3); opacity: 1; filter: blur(0px); }
      75% { transform: translateY(-30px) translateZ(0) rotateY(270deg) scale(1); opacity: 1; filter: blur(0px); }
    }
    @keyframes dna-twist-reverse {
      0%, 100% { transform: translateY(0) translateZ(60px) rotateY(180deg) scale(1.3); opacity: 1; filter: blur(0px); }
      25% { transform: translateY(-30px) translateZ(0) rotateY(270deg) scale(1); opacity: 1; filter: blur(0px); }
      50% { transform: translateY(0) translateZ(-60px) rotateY(360deg) scale(0.5); opacity: 0.2; filter: blur(4px); }
      75% { transform: translateY(30px) translateZ(0) rotateY(450deg) scale(1); opacity: 1; filter: blur(0px); }
    }
    @keyframes dna-conn-fade {
      0%, 50%, 100% { opacity: 0.1; transform: scaleY(0.7); }
      25%, 75% { opacity: 0.5; transform: scaleY(1.2); }
    }
    @keyframes dna-pulse {
      0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); border-color: rgba(59, 130, 246, 0.3); }
      50% { box-shadow: 0 0 35px rgba(59, 130, 246, 0.9), 0 0 60px rgba(139, 92, 246, 0.6); border-color: rgba(139, 92, 246, 0.8); }
    }
    .progress-text {
      position: absolute;
      bottom: 16px;
      right: 24px;
      font-size: 1.1rem;
      font-weight: 900;
      color: #f4f4f5;
      z-index: 10;
      font-family: 'Monaco', 'Consolas', monospace;
      letter-spacing: 0.1em;
      text-shadow: 0 0 15px rgba(59, 130, 246, 0.7);
    }
    .dna-node.active { animation: dna-twist 3s infinite linear, dna-pulse 1.5s infinite ease-in-out; }
    .dna-node.active-pair { animation: dna-twist-reverse 3s infinite linear, dna-pulse 1.5s infinite ease-in-out; }
    .node-top { animation: dna-twist 3s infinite linear; }
    .node-bottom { animation: dna-twist-reverse 3s infinite linear; }
    .dna-connection {
      position: absolute;
      width: 2px;
      left: 5px;
      top: -20px;
      height: 50px;
      background: rgba(255, 255, 255, 0.03);
      transition: all 0.5s ease;
      z-index: 1;
      transform-style: preserve-3d;
    }
    .dna-connection.active {
      background: linear-gradient(to bottom, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
      opacity: 0.9;
    }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .metric-card { background: #0f0f0f; padding: 20px; border-radius: 10px; border: 1px solid #27272a; position: relative; overflow: hidden; }
    .metric-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%); }
    .metric-label { font-size: 0.75rem; color: #71717a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #f4f4f5; }
    .metric-change { font-size: 0.875rem; margin-top: 4px; color: #a1a1aa; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .error { color: #ef4444; font-size: 0.875rem; display: flex; align-items: center; gap: 4px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { text-align: left; padding: 12px; font-size: 0.75rem; font-weight: 600; color: #71717a; background: #0f0f0f; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #27272a; }
    .table td { padding: 12px; font-size: 0.875rem; border-bottom: 1px solid #27272a; color: #e4e4e7; }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-long { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
    .badge-short { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
    
    /* Tabs Styles */
    .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 1px; }
    .tab { padding: 10px 20px; cursor: pointer; border-radius: 8px 8px 0 0; font-size: 0.875rem; font-weight: 600; color: #71717a; transition: all 0.2s ease; border: 1px solid transparent; border-bottom: none; margin-bottom: -1px; }
    .tab:hover { color: #e4e4e7; background: #1a1a1a; }
    .tab.active { color: #3b82f6; background: #18181b; border-color: #27272a; border-bottom-color: #18181b; }
    .tab-content { animation: fade-in 0.3s ease; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect } = React;

    const [availableSymbols, setAvailableSymbols] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [config, setConfig] = useState({
      symbols: [],
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      initialCapital: 1000,
      leverage: 10,
      leverageMin: 1,
      leverageMax: 40,
      randomizeLeverage: false,
      
      gridSpacing: 1.0,
      gridSpacingMin: 0.2,
      gridSpacingMax: 5.0,
      randomizeGridSpacing: false,
      
      useAdaptiveGrid: true,
      atrMultiplier: 2.5,
      useDynamicSLTP: true,
      tpAtrMultiplier: 4.0,
      slAtrMultiplier: 2.0,
      useBreakEvenStop: true,
      breakEvenThresholdPct: 25,
      exitOnTrendFlip: true,
      
      positionSize: 10, // DEPRECATED
      activeCapitalPct: 50,
      randomizeActiveCapital: false,
      
      maxActivePositions: 1,
      confidenceThreshold: 70,
      confidenceThresholdMin: 50,
      confidenceThresholdMax: 90,
      randomizeConfidence: false,
      
      useTrendFilter: true,
      useReversalConfirmation: true,
      useTrailingStop: true,
      useReactiveMode: true,
      reactionLookback: 12,
      reactionThreshold: 0.15,
      
      // NEW: Target margin utilization
      targetMarginUtilization: 50,
      targetMarginUtilizationMin: 20,
      targetMarginUtilizationMax: 80,
      randomizeTargetMargin: false,
      
      numBulkTests: 10
    });

    const [isRunning, setIsRunning] = useState(false);
    const [isRunningBulk, setIsRunningBulk] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [bulkResults, setBulkResults] = useState(null);
    const [error, setError] = useState(null);
    const [optimalStrategies, setOptimalStrategies] = useState([]);
    const [activeTab, setActiveTab] = useState('summary');

    useEffect(() => {
      const fetchSymbols = async () => {
        try {
          const response = await fetch('/api/backtest/symbols');
          if (response.ok) {
            const data = await response.json();
            const syms = data.data || [];
            setAvailableSymbols(syms);
            const uniqueTiers = [...new Set(syms.map(s => s.category))];
            setTiers(uniqueTiers.length > 0 ? uniqueTiers : []);
            
            // Set first symbol if none selected
            if (syms.length > 0 && config.symbols.length === 0) {
              setConfig(prev => ({
                ...prev,
                symbols: [syms[0].name]
              }));
            }
          }
        } catch (err) {
          console.error('Failed to fetch symbols:', err);
        }
      };
      fetchSymbols();
      refreshOptimalStrategies();
    }, []);

    const refreshOptimalStrategies = async () => {
      try {
        const response = await fetch('/api/backtest/optimal-strategies');
        if (response.ok) {
          const data = await response.json();
          setOptimalStrategies(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch optimal strategies:', err);
      }
    };

    const getTierSymbols = (category) => availableSymbols.filter(s => s.category === category).map(s => s.name);
      
    const getMaxLeverageForSelected = () => {
      const selectedSymbols = availableSymbols.filter(s => config.symbols.includes(s.name));
      if (selectedSymbols.length === 0) return 3;
      return Math.min(...selectedSymbols.map(s => s.maxLeverage));
    };

    const handleTierToggle = (category) => {
      const tierSymbols = getTierSymbols(category);
      const allSelected = tierSymbols.every(s => config.symbols.includes(s));
      
      if (allSelected) {
        setConfig(prev => {
          const newSymbols = prev.symbols.filter(s => !tierSymbols.includes(s));
          const maxLev = newSymbols.length > 0 
            ? Math.min(...newSymbols.map(s => availableSymbols.find(sym => sym.name === s).maxLeverage))
            : 3;
          return {
            ...prev,
            symbols: newSymbols,
            leverage: Math.min(prev.leverage, maxLev),
            leverageMax: Math.min(prev.leverageMax, maxLev)
          };
        });
      } else {
        setConfig(prev => {
          const newSymbols = [...new Set([...prev.symbols, ...tierSymbols])];
          const maxLev = Math.min(...newSymbols.map(s => availableSymbols.find(sym => sym.name === s).maxLeverage));
          return {
            ...prev,
            symbols: newSymbols,
            leverage: Math.min(prev.leverage, maxLev),
            leverageMax: Math.min(prev.leverageMax, maxLev)
          };
        });
      }
    };

    const handleSymbolToggle = (symbolName) => {
      const symbol = availableSymbols.find(s => s.name === symbolName);
      setConfig(prev => {
        const otherTierSymbols = availableSymbols.filter(s => s.category !== symbol.category && prev.symbols.includes(s.name));
        
        let newSymbols;
        if (otherTierSymbols.length > 0) {
          newSymbols = [symbolName];
        } else {
          newSymbols = prev.symbols.includes(symbolName)
            ? prev.symbols.filter(s => s !== symbolName)
            : [...prev.symbols, symbolName];
          value = Math.min(value, maxLev);
        }
        if (field === 'leverageMin') {
          value = Math.max(1, value);
        }
        setConfig(prev => ({ ...prev, [field]: value }));
      };

      const runBacktest = async () => {
        setIsRunning(true);
        setBulkResults(null);
        setProgress(0);
        setError(null);
        setResult(null);

        try {
          const response = await fetch('/api/backtest/hamburger/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbols: config.symbols,
              startTime: new Date(config.startDate).getTime(),
              endTime: new Date(config.endDate).getTime(),
              config: {
                totalInvestmentUsd: config.initialCapital,
                leverage: config.leverage,
                gridSpacing: config.gridSpacing,
                aiConfidenceThreshold: config.confidenceThreshold,
                maxActivePositions: config.maxActivePositions,
                useAdaptiveGrid: config.useAdaptiveGrid,
                atrMultiplier: config.atrMultiplier,
                useDynamicSLTP: config.useDynamicSLTP,
                tpAtrMultiplier: config.tpAtrMultiplier,
                slAtrMultiplier: config.slAtrMultiplier,
                useBreakEvenStop: config.useBreakEvenStop,
                breakEvenThresholdPct: config.breakEvenThresholdPct,
                exitOnTrendFlip: config.exitOnTrendFlip,
                useReactiveMode: config.useReactiveMode,
                reactionLookback: config.reactionLookback,
                reactionThreshold: config.reactionThreshold,
                activeCapitalPct: config.activeCapitalPct,
                targetMarginUtilization: config.targetMarginUtilization
              }
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to run backtest');
          }

          const data = await response.json();
          setProgress(100);
          setResult(data.data);
          setActiveTab('summary');
          
        } catch (err) {
          setError(err.message || 'Unknown error');
        } finally {
          setIsRunning(false);
        }
      };

      const DNAProgressBar = ({ progress }) => {
        const nodes = 32;
        return (
          <div className="dna-container">
            <div className="progress-text">{progress}% Processed</div>
            <div className="dna-strand">
              {Array.from({ length: nodes }).map((_, i) => {
                const isActive = (i / nodes) * 100 < progress;
                const delay = (i * 0.1) + 's';
                return (
                  <div key={i} className="dna-pair">
                    <div 
                      className={"dna-connection " + (isActive ? 'active' : '')} 
                      style={{ animationDelay: delay }}
                    />
                    <div 
                      className={"dna-node node-top " + (isActive ? 'active' : '')} 
                      style={{ animationDelay: delay }}
                    />
                    <div 
                      className={"dna-node node-bottom " + (isActive ? 'active-pair' : '')} 
                      style={{ animationDelay: delay }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      };

      const [sortConfig, setSortConfig] = useState({ key: 'returnPct', direction: 'desc' });

      const handleSort = (key) => {
        setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
      };

      const getSortedResults = (data) => {
        if (!data) return [];
        return [...data].sort((a, b) => {
          let aValue, bValue;
          switch (sortConfig.key) {
            case 'symbol':
              aValue = a.symbol;
              bValue = b.symbol;
              break;
            case 'returnPct':
              aValue = a.metrics?.totalReturnPct || 0;
              bValue = b.metrics?.totalReturnPct || 0;
              break;
            case 'returnUsd':
              aValue = a.metrics?.totalReturn || 0;
              bValue = b.metrics?.totalReturn || 0;
              break;
            case 'drawdown':
              aValue = a.metrics?.maxDrawdown || 0;
              bValue = b.metrics?.maxDrawdown || 0;
              break;
            case 'winRate':
              aValue = a.metrics?.winRate || 0;
              bValue = b.metrics?.winRate || 0;
              break;
            case 'trades':
              aValue = a.metrics?.totalTrades || 0;
              bValue = b.metrics?.totalTrades || 0;
              break;
            default:
              return 0;
          }
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      };

      const runBulkload = async () => {
        setIsRunningBulk(true);
        setResult(null);
        setBulkResults([]);
        setProgress(0);
        setError(null);

        const totalTests = config.numBulkTests;
        const batchSize = 5;
        const allResults = [];

        try {
          for (let i = 0; i < totalTests; i += batchSize) {
            const currentBatchSize = Math.min(batchSize, totalTests - i);
            const response = await fetch('/api/backtest/hamburger/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isBulkload: true,
                numTests: currentBatchSize,
                symbols: config.symbols,
                startTime: new Date(config.startDate).getTime(),
                endTime: new Date(config.endDate).getTime(),
                config: {
                  totalInvestmentUsd: config.initialCapital,
                  leverage: config.leverage,
                  leverageMin: config.leverageMin,
                  leverageMax: config.leverageMax,
                  randomizeLeverage: config.randomizeLeverage,
                  gridSpacing: config.gridSpacing,
                  gridSpacingMin: config.gridSpacingMin,
                  gridSpacingMax: config.gridSpacingMax,
                  randomizeGridSpacing: config.randomizeGridSpacing,
                  confidenceThreshold: config.confidenceThreshold,
                  confidenceMin: config.confidenceMin,
                  confidenceMax: config.confidenceMax,
                  randomizeConfidence: config.randomizeConfidence,
                  activeCapitalPct: config.activeCapitalPct,
                  activeCapitalMin: config.activeCapitalMin,
                  activeCapitalMax: config.activeCapitalMax,
                  randomizeActiveCapital: config.randomizeActiveCapital,
                  targetMarginUtilization: config.targetMarginUtilization,
                  targetMarginUtilizationMin: config.targetMarginUtilizationMin,
                  targetMarginUtilizationMax: config.targetMarginUtilizationMax,
                  randomizeTargetMargin: config.randomizeTargetMargin,
                  maxActivePositions: config.maxActivePositions,
                  useTrendFilter: config.useTrendFilter,
                  useAdaptiveGrid: config.useAdaptiveGrid,
                  atrMultiplier: config.atrMultiplier,
                  useDynamicSLTP: config.useDynamicSLTP,
                  tpAtrMultiplier: config.tpAtrMultiplier,
                  slAtrMultiplier: config.slAtrMultiplier,
                  useBreakEvenStop: config.useBreakEvenStop,
                  breakEvenThresholdPct: config.breakEvenThresholdPct,
                  exitOnTrendFlip: config.exitOnTrendFlip,
                  useReactiveMode: config.useReactiveMode,
                  reactionLookback: config.reactionLookback,
                  reactionThreshold: config.reactionThreshold
                }
              })
            });

            if (!response.ok) {
              const errData = await response.json();
              throw new Error(errData.error || 'Failed to run bulkload batch');
            }

            const data = await response.json();
            allResults.push(...data.data);
            setBulkResults([...allResults]);
            setProgress(Math.round(((i + currentBatchSize) / totalTests) * 100));
          }
        } catch (err) {
          setError(err.message || 'Unknown error');
        } finally {
          setIsRunningBulk(false);
          // Refresh optimal strategies after bulk backtest completes
          refreshOptimalStrategies();
        }
      };


      const downloadResults = () => {
        if (!result && !bulkResults) return;

        const data = bulkResults || result;
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        let name = 'backtest';
        if (bulkResults) {
          name = 'bulk-randomized';
        } else if (Array.isArray(result)) {
          name = 'batch-' + result.length + '-pairs';
        } else {
          name = result.symbol || config.symbols[0];
        }
        
        const exportFileDefaultName = "backtest-" + name + "-" + new Date().toISOString().split('T')[0] + ".json";
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
      };

      const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2
        }).format(value);
      };

      const formatPercentage = (value) => {
        if (typeof value !== 'number') return '0.00%';
        return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
      };

      return (
        <div className="container">
          <div style={{ marginBottom: '24px' }}>
            <h1>Hamburger Bot Backtesting</h1>
            <p className="subtitle">Test your strategy with real Hyperliquid historical data</p>
          </div>

          {/* Configuration */}
          <div className="card">
            <h2 className="card-title">
              Configuration
            </h2>
            
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: '600', fontSize: '16px', marginBottom: '8px', display: 'block' }}>
                Trading Pair(s)
              </label>
              <p className="subtitle" style={{ marginBottom: '12px' }}>Select a group OR an individual trading pair:</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {tiers.map(tier => (
                  <div key={tier} style={{ background: '#0f0f0f', padding: '16px', borderRadius: '12px', border: '1px solid #27272a', transition: 'all 0.2s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
                      <input 
                        type="checkbox" 
                        id={"tier-" + tier}
                        checked={getTierSymbols(tier).every(s => config.symbols.includes(s))}
                        onChange={() => handleTierToggle(tier)}
                        disabled={isRunning || isRunningBulk}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <label htmlFor={"tier-" + tier} style={{ fontWeight: '700', cursor: 'pointer', color: '#f4f4f5', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tier}</label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px' }}>
                      {availableSymbols.filter(s => s.category === tier).map(symbol => (
                        <div key={symbol.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="checkbox" 
                            id={"symbol-" + symbol.name}
                            checked={config.symbols.includes(symbol.name)}
                            onChange={() => handleSymbolToggle(symbol.name)}
                            disabled={isRunning || isRunningBulk}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor={"symbol-" + symbol.name} style={{ fontSize: '0.8rem', cursor: 'pointer', color: '#a1a1aa', fontWeight: '500' }}>{symbol.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">TimeFrame (Max 6 months)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#a1a1aa' }}>Start Date</label>
                    <input
                      type="date"
                      value={config.startDate}
                      onChange={(e) => handleConfigChange('startDate', e.target.value)}
                      max={config.endDate}
                      className="form-input"
                      disabled={isRunning || isRunningBulk}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', color: '#a1a1aa' }}>End Date</label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={(e) => handleConfigChange('endDate', e.target.value)}
                      min={config.startDate}
                      className="form-input"
                      disabled={isRunning || isRunningBulk}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Trading Capital/Equity (USD)</label>
                <input
                  type="number"
                  value={config.initialCapital}
                  onChange={(e) => handleConfigChange('initialCapital', Number(e.target.value))}
                  min="100"
                  step="100"
                  className="form-input"
                  disabled={isRunning || isRunningBulk}
                />
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Leverage (Max {getMaxLeverageForSelected()}x)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="randLeverage" 
                      checked={config.randomizeLeverage}
                      onChange={(e) => handleConfigChange('randomizeLeverage', e.target.checked)}
                    />
                    <label htmlFor="randLeverage" style={{ fontSize: '12px', color: '#a1a1aa' }}>Randomize</label>
                  </div>
                </div>
                {config.randomizeLeverage ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Min</label>
                      <input
                        type="number"
                        value={config.leverageMin}
                        onChange={(e) => handleConfigChange('leverageMin', Number(e.target.value))}
                        className="form-input"
                        min="1"
                        max={config.leverageMax}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Max</label>
                      <input
                        type="number"
                        value={config.leverageMax}
                        onChange={(e) => handleConfigChange('leverageMax', Math.min(Number(e.target.value), getMaxLeverageForSelected()))}
                        className="form-input"
                        min={config.leverageMin}
                        max={getMaxLeverageForSelected()}
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    value={config.leverage}
                    onChange={(e) => handleConfigChange('leverage', Math.min(Number(e.target.value), getMaxLeverageForSelected()))}
                    min="1"
                    max={getMaxLeverageForSelected()}
                    className="form-input"
                    disabled={isRunning || isRunningBulk}
                  />
                )}
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Grid Spacing (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="randGrid" 
                      checked={config.randomizeGridSpacing}
                      onChange={(e) => handleConfigChange('randomizeGridSpacing', e.target.checked)}
                    />
                    <label htmlFor="randGrid" style={{ fontSize: '12px', color: '#a1a1aa' }}>Randomize</label>
                  </div>
                </div>
                {config.randomizeGridSpacing ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Min</label>
                      <input
                        type="number"
                        value={config.gridSpacingMin}
                        onChange={(e) => handleConfigChange('gridSpacingMin', Number(e.target.value))}
                        className="form-input"
                        step="0.01"
                        min="0.01"
                        max="99.99"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Max (Up to 100%)</label>
                      <input
                        type="number"
                        value={config.gridSpacingMax}
                        onChange={(e) => handleConfigChange('gridSpacingMax', Number(e.target.value))}
                        className="form-input"
                        step="0.01"
                        max="100"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    value={config.gridSpacing}
                    onChange={(e) => handleConfigChange('gridSpacing', Number(e.target.value))}
                    min="0.01"
                    max="100"
                    step="0.01"
                    className="form-input"
                  />
                )}
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ background: '#0f0f0f', padding: '12px', borderRadius: '8px', border: '1px solid #27272a', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6', marginBottom: '4px' }}>
                    Margin & Position Sizing
                  </div>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' }}>
                    The bot automatically calculates position sizes to maintain your <strong>Target Margin Utilization</strong>. 
                    A <strong>$10 USD minimum</strong> per position is enforced. 
                    Lower utilization (20-40%) is safer; higher (60-80%) increases potential profit and risk.
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Target Margin Utilization (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="randMargin" 
                      checked={config.randomizeTargetMargin}
                      onChange={(e) => handleConfigChange('randomizeTargetMargin', e.target.checked)}
                    />
                    <label htmlFor="randMargin" style={{ fontSize: '12px', color: '#a1a1aa' }}>Randomize</label>
                  </div>
                </div>
                {config.randomizeTargetMargin ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Min (%)</label>
                      <input
                        type="number"
                        value={config.targetMarginUtilizationMin}
                        onChange={(e) => handleConfigChange('targetMarginUtilizationMin', Number(e.target.value))}
                        className="form-input"
                        min="10"
                        max={config.targetMarginUtilizationMax}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Max (%)</label>
                      <input
                        type="number"
                        value={config.targetMarginUtilizationMax}
                        onChange={(e) => handleConfigChange('targetMarginUtilizationMax', Number(e.target.value))}
                        className="form-input"
                        min={config.targetMarginUtilizationMin}
                        max="90"
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="range" 
                      min="20" 
                      max="80" 
                      value={config.targetMarginUtilization}
                      onChange={(e) => handleConfigChange('targetMarginUtilization', Number(e.target.value))}
                      disabled={isRunning || isRunningBulk}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '35px', textAlign: 'right' }}>{config.targetMarginUtilization}%</span>
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                  Aims to keep <strong>{config.randomizeTargetMargin ? '20-80%' : config.targetMarginUtilization + '%'}</strong> of your capital active. 
                  The rest is kept as a <strong>safety reserve</strong> for the AI Emergency Brake and market volatility.
                </div>
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Confidence Threshold (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input 
                      type="checkbox" 
                      id="randConf" 
                      checked={config.randomizeConfidence}
                      onChange={(e) => handleConfigChange('randomizeConfidence', e.target.checked)}
                    />
                    <label htmlFor="randConf" style={{ fontSize: '12px', color: '#a1a1aa' }}>Randomize</label>
                  </div>
                </div>
                {config.randomizeConfidence ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>From (%)</label>
                      <input
                        type="number"
                        value={config.confidenceMin}
                        onChange={(e) => handleConfigChange('confidenceMin', Number(e.target.value))}
                        className="form-input"
                        min="1"
                        max={config.confidenceMax}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>To (%)</label>
                      <input
                        type="number"
                        value={config.confidenceMax}
                        onChange={(e) => handleConfigChange('confidenceMax', Number(e.target.value))}
                        className="form-input"
                        min={config.confidenceMin}
                        max="99"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    value={config.confidenceThreshold}
                    onChange={(e) => handleConfigChange('confidenceThreshold', Number(e.target.value))}
                    min="1"
                    max="99"
                    className="form-input"
                  />
                )}
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                  AI requires this minimum confidence level to approve a trade entry.
                </div>
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Advanced Grid & Protection</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="useAdaptiveGrid" 
                        checked={config.useAdaptiveGrid}
                        onChange={(e) => handleConfigChange('useAdaptiveGrid', e.target.checked)}
                      />
                      <label htmlFor="useAdaptiveGrid" style={{ fontSize: '12px', color: '#e4e4e7' }}>Adaptive Grid</label>
                    </div>
                    {config.useAdaptiveGrid && (
                      <div style={{ paddingLeft: '24px' }}>
                        <label style={{ fontSize: '11px', color: '#a1a1aa' }}>ATR Mult.</label>
                        <input
                          type="number"
                          value={config.atrMultiplier}
                          onChange={(e) => handleConfigChange('atrMultiplier', Number(e.target.value))}
                          className="form-input"
                          step="0.1"
                          min="0.5"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="useDynamicSLTP" 
                        checked={config.useDynamicSLTP}
                        onChange={(e) => handleConfigChange('useDynamicSLTP', e.target.checked)}
                      />
                      <label htmlFor="useDynamicSLTP" style={{ fontSize: '12px', color: '#e4e4e7' }}>Dynamic SL/TP</label>
                    </div>
                    {config.useDynamicSLTP && (
                      <div style={{ paddingLeft: '24px', display: 'flex', gap: '4px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: '#a1a1aa' }}>TP</label>
                          <input
                            type="number"
                            value={config.tpAtrMultiplier}
                            onChange={(e) => handleConfigChange('tpAtrMultiplier', Number(e.target.value))}
                            className="form-input"
                            step="0.1"
                            style={{ padding: '4px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', color: '#a1a1aa' }}>SL</label>
                          <input
                            type="number"
                            value={config.slAtrMultiplier}
                            onChange={(e) => handleConfigChange('slAtrMultiplier', Number(e.target.value))}
                            className="form-input"
                            step="0.1"
                            style={{ padding: '4px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="useBreakEvenStop" 
                      checked={config.useBreakEvenStop}
                      onChange={(e) => handleConfigChange('useBreakEvenStop', e.target.checked)}
                    />
                    <label htmlFor="useBreakEvenStop" style={{ fontSize: '12px', color: '#e4e4e7' }}>Break Even Stop</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="exitOnTrendFlip" 
                      checked={config.exitOnTrendFlip}
                      onChange={(e) => handleConfigChange('exitOnTrendFlip', e.target.checked)}
                    />
                    <label htmlFor="exitOnTrendFlip" style={{ fontSize: '12px', color: '#e4e4e7' }}>Trend Flip Exit</label>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Filters & Protection</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="useTrendFilter" 
                      checked={config.useTrendFilter}
                      onChange={(e) => handleConfigChange('useTrendFilter', e.target.checked)}
                    />
                    <label htmlFor="useTrendFilter" style={{ fontSize: '12px', color: '#e4e4e7' }}>Trend Filter</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="useTrailingStop" 
                      checked={config.useTrailingStop}
                      onChange={(e) => handleConfigChange('useTrailingStop', e.target.checked)}
                    />
                    <label htmlFor="useTrailingStop" style={{ fontSize: '12px', color: '#e4e4e7' }}>Trailing Stop</label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="useReversalConfirmation" 
                      checked={config.useReversalConfirmation}
                      onChange={(e) => handleConfigChange('useReversalConfirmation', e.target.checked)}
                    />
                    <label htmlFor="useReversalConfirmation" style={{ fontSize: '12px', color: '#e4e4e7' }}>Reversal Conf.</label>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>AI Emergency Brake</label>
                </div>
                <div style={{ background: '#0f0f0f', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' }}>
                    The <strong>AI Emergency Brake</strong> automatically closes all positions if market conditions become too volatile or AI confidence drops below your <strong>Confidence Threshold</strong>. 
                    This protects your reserve capital during flash crashes.
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Reactive Mode</label>
                  <input 
                    type="checkbox" 
                    id="useReactiveMode" 
                    checked={config.useReactiveMode}
                    onChange={(e) => handleConfigChange('useReactiveMode', e.target.checked)}
                  />
                </div>
                <div style={{ background: '#0f0f0f', padding: '12px', borderRadius: '8px', border: '1px solid #27272a', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' }}>
                    <strong>Reactive Mode</strong> allows the bot to shift its bias (Long/Short) based on immediate price action velocity, bypassing slower technical indicators when momentum is high.
                  </div>
                </div>
                {config.useReactiveMode && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Lookback</label>
                      <input
                        type="number"
                        value={config.reactionLookback}
                        onChange={(e) => handleConfigChange('reactionLookback', Number(e.target.value))}
                        className="form-input"
                        min="1"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Thresh %</label>
                      <input
                        type="number"
                        value={config.reactionThreshold}
                        onChange={(e) => handleConfigChange('reactionThreshold', Number(e.target.value))}
                        className="form-input"
                        step="0.01"
                        min="0.01"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Dynamic Position Sizing</label>
                </div>
                <div style={{ background: '#0f0f0f', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' }}>
                    <strong>Dynamic Position Sizing</strong> automatically adjusts position sizes based on market volatility and AI confidence levels. 
                    In high-volatility markets, positions are reduced to minimize risk. In stable conditions with high confidence, positions are increased to maximize returns.
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Number of Bulk Tests</label>
                <input
                  type="number"
                  value={config.numBulkTests}
                  onChange={(e) => handleConfigChange('numBulkTests', Number(e.target.value))}
                  min="1"
                  max="100"
                  className="form-input"
                  disabled={isRunning || isRunningBulk}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
              <button
                onClick={runBacktest}
                disabled={isRunning || isRunningBulk || config.symbols.length === 0}
                className="btn btn-primary"
              >
                  {isRunning ? (
                    <>
                      Running... {progress}%
                    </>
                  ) : (
                    <>
                      Run Customized Single Backtest
                    </>
                  )}
              </button>

              <button
                onClick={runBulkload}
                disabled={isRunning || isRunningBulk || config.symbols.length === 0}
                className="btn"
                style={{ background: '#10b981', color: 'white' }}
              >
                {isRunningBulk ? (
                  <>
                    Bulkloading... {progress}%
                  </>
                ) : (
                  <>
                    Run Customized Bulkload of ({config.numBulkTests}) Tests
                  </>
                )}
              </button>
              
              {error && (
                <div className="error">
                  Error: {error}
                </div>
              )}
            </div>

            {(isRunning || isRunningBulk) && (
            )}
          </div>


          {/* Single Result Detail (only if exactly 1 result) */}
          {result && !Array.isArray(result) && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="card-title" style={{ marginBottom: 0 }}>
                  Backtest Results: {result.symbol}
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={downloadResults} className="btn btn-secondary">Download JSON</button>
                </div>
              </div>

              <div className="tabs">
                <div className={activeTab === 'summary' ? 'tab active' : 'tab'} onClick={() => setActiveTab('summary')}>Summary</div>
                <div className={activeTab === 'trades' ? 'tab active' : 'tab'} onClick={() => setActiveTab('trades')}>Trades</div>
                <div className={activeTab === 'ai' ? 'tab active' : 'tab'} onClick={() => setActiveTab('ai')}>AI Insights</div>
                <div className={activeTab === 'history' ? 'tab active' : 'tab'} onClick={() => setActiveTab('history')}>Opt. History</div>
                <div className={activeTab === 'audit' ? 'tab active' : 'tab'} onClick={() => setActiveTab('audit')}>Decision Audit</div>
                <div className={activeTab === 'evolution' ? 'tab active' : 'tab'} onClick={() => setActiveTab('evolution')}>Strategy Evolution</div>
              </div>

              <div className="tab-content">
                {activeTab === 'summary' && (
                  <div>
                    <div className="metrics-grid">
                      <div className="metric-card">
                        <div className="metric-label">Total Return</div>
                        <div className={'metric-value ' + (result.metrics.totalReturnPct >= 0 ? 'positive' : 'negative')}>{formatPercentage(result.metrics.totalReturnPct)}</div>
                        <div className="metric-change">{formatCurrency(result.metrics.totalReturn)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Sharpe Ratio</div>
                        <div className="metric-value">{result.metrics.sharpeRatio.toFixed(2)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Max Drawdown</div>
                        <div className="metric-value negative">{formatPercentage(result.metrics.maxDrawdown)}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Win Rate</div>
                        <div className="metric-value">{result.metrics.winRate.toFixed(1)}%</div>
                        <div className="metric-change">{result.metrics.totalTrades} trades</div>
                      </div>
                      <div className="metric-card" style={{ borderLeft: '4px solid #ef4444' }}>
                        <div className="metric-label">AI Interventions</div>
                        <div className="metric-value">{result.trades.filter(t => t.exitReason === 'AI Risk Management').length}</div>
                        <div className="metric-change" style={{ color: '#71717a' }}>"Emergency Brake" triggers</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Backtest Confidence</div>
                        <div className="metric-value">{result.metrics.confidenceScore.toFixed(0)}%</div>
                        <div className="metric-change" style={{ color: '#71717a' }}>Data/Execution Reliability</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Target Margin</div>
                        <div className="metric-value">{result.config.targetMarginUtilization}%</div>
                        <div className="metric-change" style={{ color: '#71717a' }}>Configured Utilization</div>
                      </div>
                    </div>

                    {result.metrics.feeBreakdown && (
                      <div className="metrics-grid" style={{ marginTop: '20px' }}>
                        <div className="metric-card" style={{ borderTop: '2px solid #71717a' }}>
                          <div className="metric-label">Total Fees Paid</div>
                          <div className="metric-value">{formatCurrency(result.metrics.totalFees)}</div>
                          <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>
                            Taker: {formatCurrency(result.metrics.feeBreakdown.takerFees)} | Funding: {formatCurrency(result.metrics.feeBreakdown.fundingFees)}
                          </div>
                        </div>
                        <div className="metric-card" style={{ borderTop: '2px solid #71717a' }}>
                          <div className="metric-label">Slippage Impact</div>
                          <div className="metric-value">{formatCurrency(result.metrics.feeBreakdown.slippageCosts)}</div>
                          <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>Est. execution gap</div>
                        </div>
                        <div className="metric-card" style={{ borderTop: '2px solid #71717a' }}>
                          <div className="metric-label">Value at Risk (95%)</div>
                          <div className="metric-value negative">{formatCurrency(result.metrics.riskMetrics.var95)}</div>
                          <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>Est. downside potential</div>
                        </div>
                        <div className="metric-card" style={{ borderTop: '2px solid #71717a' }}>
                          <div className="metric-label">Max Consecutive Loss</div>
                          <div className="metric-value negative">{result.metrics.riskMetrics.largestConsecutiveLoss}</div>
                          <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>Trading streak risk</div>
                        </div>
                      </div>
                    )}

                    {result.equityCurve && result.equityCurve.length > 0 && (
                      <div className="card" style={{ background: '#0f0f0f', marginTop: '20px' }}>
                        <h3 className="card-title" style={{ fontSize: '1rem' }}>Equity Curve</h3>
                        <EquityChart data={result.equityCurve} />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'trades' && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>PnL</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.slice(-50).reverse().map((trade, index) => (
                        <tr key={index}>
                          <td><span className={"badge badge-" + trade.side}>{trade.side.toUpperCase()}</span></td>
                          <td>{"$" + trade.entryPrice.toFixed(4)}</td>
                          <td>{"$" + trade.exitPrice.toFixed(4)}</td>
                          <td className={trade.pnl >= 0 ? 'positive' : 'negative'}>{formatCurrency(trade.pnl)}</td>
                          <td>{trade.exitReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'ai' && (
                  <div>
                    {result.dailyReports && result.dailyReports.length > 0 ? (
                      <div id="ai-insights">
                        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
                          <div className="metric-card">
                            <div className="metric-label">Learning Cycles</div>
                            <div style={{ fontSize: '14px', color: '#3b82f6', marginTop: '8px' }}>
                              {result.dailyReports.length} days processed
                            </div>
                          </div>
                          <div className="metric-card">
                            <div className="metric-label">Intervention Rate</div>
                            <div style={{ fontSize: '14px', color: '#ef4444', marginTop: '8px' }}>
                              {((result.trades.filter(t => t.exitReason === 'AI Risk Management').length / Math.max(1, result.metrics.totalTrades)) * 100).toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '11px', color: '#71717a', marginTop: '4px' }}>Trades closed by AI Brake</div>
                          </div>
                          <div className="metric-card">
                            <div className="metric-label">Optimization Status</div>
                            <div style={{ fontSize: '14px', color: '#10b981', marginTop: '8px' }}>
                              {result.optimizationTests.filter(t => t.status === 'applied' || t.status === 'testing').length} Applied, 
                              {' '}{result.optimizationTests.filter(t => t.status === 'adopted').length} Adopted,
                              {' '}{result.optimizationTests.filter(t => t.status === 'reverted').length} Reverted
                            </div>
                          </div>
                        </div>

                        {result.metrics.signalAccuracy && (
                          <div className="card" style={{ background: '#0f0f0f', marginBottom: '20px' }}>
                            <h3 className="card-title" style={{ fontSize: '1rem' }}>Signal Effectiveness</h3>
                            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                              <div className="metric-card" style={{ background: '#141414' }}>
                                <div className="metric-label">SAR Accuracy</div>
                                <div className="metric-value">{result.metrics.signalAccuracy.parabolicSAR.toFixed(1)}%</div>
                              </div>
                              <div className="metric-card" style={{ background: '#141414' }}>
                                <div className="metric-label">Volume Spike</div>
                                <div className="metric-value">{result.metrics.signalAccuracy.volumeSpike.toFixed(1)}%</div>
                              </div>
                              <div className="metric-card" style={{ background: '#141414' }}>
                                <div className="metric-label">ROC Accuracy</div>
                                <div className="metric-value">{result.metrics.signalAccuracy.roc.toFixed(1)}%</div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
                          <div className="metric-card">
                            <div className="metric-label">Latest Wins</div>
                            <div style={{ fontSize: '14px', color: '#10b981', marginTop: '8px' }}>
                              {result.dailyReports[result.dailyReports.length - 1].analysis.whatWorked.length > 0 ? 
                                result.dailyReports[result.dailyReports.length - 1].analysis.whatWorked.join('; ') : 
                                'No specific strengths identified'
                              }
                            </div>
                          </div>
                          <div className="metric-card">
                            <div className="metric-label">Latest Risks</div>
                            <div style={{ fontSize: '14px', color: '#ef4444', marginTop: '8px' }}>
                              {result.dailyReports[result.dailyReports.length - 1].analysis.whatFailed.length > 0 ? 
                                result.dailyReports[result.dailyReports.length - 1].analysis.whatFailed.join('; ') : 
                                'No major issues identified'
                              }
                            </div>
                          </div>
                        </div>
                        
                        {result.dailyReports[result.dailyReports.length - 1].analysis.suggestions.length > 0 && (
                          <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#f4f4f5' }}>
                              🎯 Latest Optimization Suggestions
                            </h3>
                            {result.dailyReports[result.dailyReports.length - 1].analysis.suggestions.slice(0, 3).map((suggestion, index) => (
                              <div key={index} style={{ 
                                background: '#0f0f0f', 
                                padding: '12px', 
                                borderRadius: '6px', 
                                marginBottom: index < 2 ? '8px' : '0',
                                border: '1px solid #27272a'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontWeight: '600', color: '#3b82f6' }}>{suggestion.parameter}</span>
                                  <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                                    Impact: {suggestion.expectedImpact} | Confidence: {suggestion.confidence}%
                                  </span>
                                </div>
                                <div style={{ fontSize: '14px', color: '#e4e4e7' }}>{suggestion.currentValue} → {suggestion.suggestedValue}</div>
                                <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>{suggestion.reason}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {result.decisions && result.decisions.length > 0 && (
                          <div className="card" style={{ background: '#0f0f0f', marginTop: '20px' }}>
                            <h3 className="card-title" style={{ fontSize: '1rem' }}>AI Confidence Trend</h3>
                            <ConfidenceChart data={result.decisions} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#71717a' }}>No AI insights generated yet. Run a longer backtest to see analysis.</p>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div id="optimization-history">
                    {result.dailyReports && result.dailyReports.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {result.dailyReports.slice().reverse().map((report, idx) => {
                          const testsThisDay = result.optimizationTests.filter(t => t.startDate === report.date);
                          const finalizedTests = result.optimizationTests.filter(t => t.endDate === report.date && (t.status === 'reverted' || t.status === 'adopted'));
 　 　 　 　 　 　 　 　 return (
                            <div key={idx} style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontWeight: '700', color: '#3b82f6' }}>{report.date}</span>
                                <span style={{ fontSize: '12px', color: report.performance.returnPct >= 0 ? '#10b981' : '#ef4444' }}>
                                  Return: {report.performance.returnPct.toFixed(2)}% | Sharpe: {report.performance.sharpeRatio.toFixed(2)}
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>WHAT WORKED</div>
                                  <ul style={{ fontSize: '12px', paddingLeft: '16px', color: '#a1a1aa' }}>
                                    {report.analysis.whatWorked.map((item, i) => <li key={i}>{item}</li>)}
                                  </ul>
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>WHAT FAILED</div>
                                  <ul style={{ fontSize: '12px', paddingLeft: '16px', color: '#a1a1aa' }}>
                                    {report.analysis.whatFailed.map((item, i) => <li key={i}>{item}</li>)}
                                  </ul>
                                </div>
                              </div>
                              {(testsThisDay.length > 0 || finalizedTests.length > 0) && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #27272a' }}>
                                  <div style={{ fontSize: '11px', color: '#71717a', marginBottom: '8px' }}>SELF-IMPROVEMENT LOG</div>
                                  {testsThisDay.map((test, i) => (
                                    <div key={'new-'+i} style={{ fontSize: '12px', color: '#3b82f6', marginBottom: '4px' }}>
                                      Applied Change: {test.parameter} ({test.oldValue} → {test.newValue})
                                      <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', fontSize: '10px' }}>{test.status === 'testing' ? 'TESTING' : test.status.toUpperCase()}</span>
                                    </div>
                                  ))}
                                  {finalizedTests.map((test, i) => (
                                    <div key={'final-'+i} style={{ fontSize: '12px', color: test.status === 'reverted' ? '#ef4444' : '#10b981', marginBottom: '4px' }}>
                                      {test.status === 'reverted' ? 'Reverted' : 'Adopted'} Change: {test.parameter} 
                                      <div style={{ fontSize: '11px', color: '#71717a', marginLeft: '12px' }}>
                                        Reason: {test.reason || 'Period end evaluation'}
                                      </div>
                                      <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', background: test.status === 'reverted' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', fontSize: '10px' }}>{test.status.toUpperCase()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#71717a' }}>No optimization history available.</p>
                    )}
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div id="decision-audit">
                    {result.decisions && result.decisions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {result.decisions.slice(-100).reverse().map((decision, idx) => (
                          <div key={idx} style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>{new Date(decision.timestamp).toLocaleTimeString()}</span>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: decision.confidence >= result.config.aiConfidenceThreshold ? '#10b981' : '#ef4444' }}>
                                Confidence: {decision.confidence}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {decision.reasoning.map((reason, i) => (
                                <span key={i} style={{ fontSize: '11px', background: '#0f0f0f', padding: '2px 8px', borderRadius: '4px', border: '1px solid #27272a', color: '#d4d4d8' }}>
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p style={{ fontSize: '11px', color: '#71717a', textAlign: 'center' }}>Showing last 100 decision markers</p>
                      </div>
                    ) : (
                      <p style={{ color: '#71717a' }}>No decision audit data available.</p>
                    )}
                  </div>
                )}

                {activeTab === 'evolution' && (
                  <div id="strategy-evolution">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                      <div className="card" style={{ background: '#0f0f0f', margin: 0 }}>
                        <h3 className="card-title" style={{ fontSize: '1rem' }}>Parameter Evolution</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {['gridSpacing', 'confidenceThreshold', 'targetMarginUtilization', 'atrMultiplier', 'tpAtrMultiplier', 'slAtrMultiplier'].map(param => {
                            const initial = result.config[param];
                            const current = result.finalConfig ? result.finalConfig[param] : initial;
                            const diff = (current !== undefined && initial !== undefined) ? current - initial : 0;
                            return (
                              <div key={param} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>{param}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.875rem', textDecoration: 'line-through', color: '#71717a' }}>{initial}</span>
                                  <span style={{ fontSize: '1rem', fontWeight: '600', color: '#f4f4f5' }}>{current}</span>
                                  {diff !== 0 && (
                                    <span style={{ fontSize: '0.75rem', color: diff > 0 ? '#10b981' : '#ef4444' }}>
                                      ({diff > 0 ? '+' : ''}{diff.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="card" style={{ background: '#0f0f0f', margin: 0 }}>
                        <h3 className="card-title" style={{ fontSize: '1rem' }}>Final Evolved Settings</h3>
                        <div style={{ fontSize: '0.875rem', color: '#a1a1aa', lineHeight: '1.6' }}>
                          The bot has evolved these settings based on market feedback. You can use these finalized parameters for your next live run.
                        </div>
                        <div style={{ marginTop: '16px', background: '#1a1a1a', padding: '12px', borderRadius: '8px', border: '1px solid #3f3f46' }}>
                          <pre style={{ fontSize: '11px', color: '#3b82f6', overflowX: 'auto' }}>
                            {JSON.stringify(result.finalConfig || result.config, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optimal Strategies Section */}
          {optimalStrategies && optimalStrategies.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 className="card-title">
                  Most Profitable Strategies (Per Symbol)
                </h2>
                <button
                  onClick={refreshOptimalStrategies}
                  className="btn btn-secondary"
                >
                  Refresh
                </button>
              </div>

              <div className="optimal-strategies-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {optimalStrategies.map((strategy, index) => (
                  <div key={index} style={{
                    background: '#141414',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ color: '#3b82f6', fontSize: '1.1rem', fontWeight: '600' }}>
                        {strategy.symbol}
                      </h3>
                      <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
                        {strategy.date}
                      </span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div>
                        <span style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>Return</span>
                        <div style={{ color: strategy.metrics.totalReturnPct >= 0 ? '#22c55e' : '#ef4444', fontWeight: '600' }}>
                          {formatPercentage(strategy.metrics.totalReturnPct)}
                        </div>
                        {strategy.metrics.backtestDurationHours && strategy.metrics.backtestDurationHours !== 24 && (
                          <div style={{ color: '#71717a', fontSize: '0.625rem', marginTop: '2px' }}>
                            {formatPercentage(strategy.metrics.totalReturnPct / strategy.metrics.backtestDurationHours * 24)} / 24h
                          </div>
                        )}
                      </div>
                      <div>
                        <span style={{ color: '#a1a1aa', fontSize: '0.75rem' }}>Win Rate</span>
                        <div style={{ color: '#f4f4f5', fontWeight: '600' }}>
                          {strategy.metrics.winRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: '#d4d4d8', marginBottom: '8px' }}>
                      <strong>Strategy:</strong> Self-improving Grid
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: '1.4' }}>
                      <div>Leverage: {strategy.strategy.leverage}x</div>
                      <div>Grid Spacing: {strategy.strategy.gridSpacing.toFixed(2)}%</div>
                      <div>Confidence: {strategy.strategy.confidenceThreshold}%</div>
                      <div>Target Margin: {strategy.strategy.targetMarginUtilization}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<BacktestApp />);
  </script>
</body>
</html>`;
}
