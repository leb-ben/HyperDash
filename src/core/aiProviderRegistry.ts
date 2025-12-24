// AI Provider Registry - Centralized model configuration
// Supports Cerberas, Perplexity, and OpenAI with proper rate limits and context windows

export interface AIModel {
  id: string;
  name: string;
  provider: 'cerebras' | 'perplexity' | 'openai';
  maxTokens: number;
  contextWindow: number;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    tokensPerMinute: number;
    tokensPerHour: number;
    tokensPerDay: number;
  };
  description?: string;
  isPreview?: boolean;
}

export const AI_MODELS: Record<string, AIModel> = {
  // Cerebras Models
  'gpt-oss-120b': {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS-120B',
    provider: 'cerebras',
    maxTokens: 55636,
    contextWindow: 55636,
    rateLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 800,
      requestsPerDay: 14400,
      tokensPerMinute: 64000,
      tokensPerHour: 1000000,
      tokensPerDay: 1000000,
    },
    description: 'High-performance model with excellent reasoning capabilities',
  },
  
  'llama-3.3-70b': {
    id: 'llama-3.3-70b',
    name: 'LLaMA 3.3 70B',
    provider: 'cerebras',
    maxTokens: 55636,
    contextWindow: 55636,
    rateLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 800,
      requestsPerDay: 14400,
      tokensPerMinute: 64000,
      tokensPerHour: 1000000,
      tokensPerDay: 1000000,
    },
    description: 'Latest LLaMA model with improved reasoning',
  },
  
  'qwen-3-235b-a22b-instruction-2507': {
    id: 'qwen-3-235b-a22b-instruction-2507',
    name: 'QWEN-3-235B-A22B-INSTRUCTION-2507',
    provider: 'cerebras',
    maxTokens: 55636,
    contextWindow: 55636,
    rateLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 800,
      requestsPerDay: 14400,
      tokensPerMinute: 64000,
      tokensPerHour: 1000000,
      tokensPerDay: 1000000,
    },
    description: 'New cutting-edge preview model with advanced instruction following',
    isPreview: true,
  },
  
  'vai-glm-4.6': {
    id: 'vai-glm-4.6',
    name: 'VAI-GLM-4.6',
    provider: 'cerebras',
    maxTokens: 64000,
    contextWindow: 64000,
    rateLimits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 100,
      tokensPerMinute: 64000,
      tokensPerHour: 1000000,
      tokensPerDay: 1000000,
    },
    description: 'General model with good multilingual capabilities',
  },
  
  'llama-3.1-70b': {
    id: 'llama-3.1-70b',
    name: 'LLaMA 3.1 70B',
    provider: 'cerebras',
    maxTokens: 55636,
    contextWindow: 55636,
    rateLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 800,
      requestsPerDay: 14400,
      tokensPerMinute: 64000,
      tokensPerHour: 1000000,
      tokensPerDay: 1000000,
    },
    description: 'Stable LLaMA 3.1 model',
  },
  
  // Perplexity Models (using their API)
  'llama-3.1-sonar-large-128k-online': {
    id: 'llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large 128K Online',
    provider: 'perplexity',
    maxTokens: 127072,
    contextWindow: 128000,
    rateLimits: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
      requestsPerDay: 20000,
      tokensPerMinute: 100000,
      tokensPerHour: 2000000,
      tokensPerDay: 10000000,
    },
    description: 'Large model with online search capabilities',
  },
  
  'llama-3.1-sonar-small-128k-online': {
    id: 'llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small 128K Online',
    provider: 'perplexity',
    maxTokens: 127072,
    contextWindow: 128000,
    rateLimits: {
      requestsPerMinute: 100,
      requestsPerHour: 2000,
      requestsPerDay: 40000,
      tokensPerMinute: 200000,
      tokensPerHour: 4000000,
      tokensPerDay: 20000000,
    },
    description: 'Fast model with online search capabilities',
  },
  
  'mixtral-8x7b-instruct': {
    id: 'mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B Instruct',
    provider: 'perplexity',
    maxTokens: 32768,
    contextWindow: 32768,
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1200,
      requestsPerDay: 24000,
      tokensPerMinute: 120000,
      tokensPerHour: 2400000,
      tokensPerDay: 12000000,
    },
    description: 'Mixture of experts model for instruction following',
  },
  
  // OpenAI Models (for completeness)
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    maxTokens: 128000,
    contextWindow: 128000,
    rateLimits: {
      requestsPerMinute: 500,
      requestsPerHour: 10000,
      requestsPerDay: 10000,
      tokensPerMinute: 150000,
      tokensPerHour: 3000000,
      tokensPerDay: 10000000,
    },
    description: 'OpenAI\'s flagship model',
  },
  
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 128000,
    contextWindow: 128000,
    rateLimits: {
      requestsPerMinute: 5000,
      requestsPerHour: 10000,
      requestsPerDay: 10000,
      tokensPerMinute: 10000000,
      tokensPerHour: 10000000,
      tokensPerDay: 10000000,
    },
    description: 'OpenAI\'s latest multimodal model',
  },
};

export function getModelById(modelId: string): AIModel | undefined {
  return AI_MODELS[modelId];
}

export function getModelsByProvider(provider: string): AIModel[] {
  return Object.values(AI_MODELS).filter(model => model.provider === provider);
}

export function getAllModels(): AIModel[] {
  return Object.values(AI_MODELS);
}

export function getRecommendedModels(): AIModel[] {
  // Return top 3 models based on performance and capabilities
  return [
    AI_MODELS['qwen-3-235b-a22b-instruction-2507']!, // Latest preview
    AI_MODELS['gpt-oss-120b']!, // High performance
    AI_MODELS['llama-3.3-70b']!, // Latest stable
  ];
}

export const CEREBRAS_MODELS = [
  AI_MODELS['qwen-3-235b-a22b-instruction-2507']!, // Latest preview
  AI_MODELS['gpt-oss-120b']!, // High performance
  AI_MODELS['llama-3.3-70b']!, // Latest stable
  AI_MODELS['vai-glm-4.6']!, // Multilingual
  AI_MODELS['llama-3.1-70b']!, // Previous stable
].filter(Boolean) as AIModel[];
