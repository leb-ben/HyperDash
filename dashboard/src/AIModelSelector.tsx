import React, { useState, useEffect } from 'react';
import { Brain, Settings, Check, AlertTriangle } from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  provider: 'cerebras' | 'perplexity' | 'openai';
  maxTokens: number;
  contextWindow: number;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  description?: string;
  isPreview?: boolean;
}

interface AIModelSelectorProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  availableModels: AIModel[];
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({
  currentModel,
  onModelChange,
  availableModels
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);

  const filteredModels = selectedProvider === 'all' 
    ? availableModels 
    : availableModels.filter(m => m.provider === selectedProvider);

  const currentModelData = availableModels.find(m => m.id === currentModel);

  const providerColors = {
    cerebras: 'text-blue-400 border-blue-400/30',
    perplexity: 'text-purple-400 border-purple-400/30',
    openai: 'text-green-400 border-green-400/30'
  };

  const providerBgColors = {
    cerebras: 'bg-blue-900/20',
    perplexity: 'bg-purple-900/20',
    openai: 'bg-green-900/20'
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">AI Model</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-slate-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Current Model Display */}
        {currentModelData && (
          <div className={`p-3 rounded-lg border ${providerColors[currentModelData.provider]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{currentModelData.name}</span>
              {currentModelData.isPreview && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">PREVIEW</span>
              )}
              <Check className="w-3 h-3 ml-auto" />
            </div>
            <div className="text-xs text-slate-400">
              {currentModelData.provider.toUpperCase()} • {currentModelData.contextWindow.toLocaleString()} context
            </div>
            {currentModelData.description && (
              <div className="text-xs text-slate-500 mt-1">{currentModelData.description}</div>
            )}
          </div>
        )}

        {/* Expanded Model Selection */}
        {expanded && (
          <div className="mt-4 space-y-3">
            {/* Provider Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`px-3 py-1 text-xs rounded ${
                  selectedProvider === 'all' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                All Providers
              </button>
              {Object.keys(providerColors).map(provider => (
                <button
                  key={provider}
                  onClick={() => setSelectedProvider(provider)}
                  className={`px-3 py-1 text-xs rounded capitalize ${
                    selectedProvider === provider 
                      ? providerBgColors[provider as keyof typeof providerBgColors] + ' text-white border'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>

            {/* Model List */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setExpanded(false);
                  }}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    model.id === currentModel
                      ? providerColors[model.provider] + ' bg-white/5'
                      : 'border-slate-700/50 hover:border-slate-600/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{model.name}</span>
                    {model.isPreview && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">PREVIEW</span>
                    )}
                    {model.id === currentModel && (
                      <Check className="w-3 h-3 ml-auto" />
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {model.provider.toUpperCase()} • {model.contextWindow.toLocaleString()} context
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {model.rateLimits.requestsPerMinute} req/min • {model.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
