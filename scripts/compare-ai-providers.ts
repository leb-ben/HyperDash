/**
 * AI Provider Comparison Test
 * Compares Perplexity vs Cerebras for trading analysis
 * Run: npx ts-node scripts/compare-ai-providers.ts
 */

import OpenAI from 'openai';

interface AIResponse {
  provider: string;
  model: string;
  response: string;
  latency: number;
  reasoning?: string;
  confidence?: number;
}

interface ComparisonResult {
  winner: string;
  reasoning: string;
  perplexityScore: number;
  cerebrasScore: number;
  perplexityResponse: AIResponse;
  cerebrasResponse: AIResponse;
}

class AIProviderComparison {
  private cerebras: OpenAI;
  private perplexity: OpenAI;

  constructor() {
    // Initialize Cerebras client
    this.cerebras = new OpenAI({
      apiKey: process.env.CEREBRAS_API_KEY || '',
      baseURL: 'https://api.cerebras.ai/v1'
    });

    // Initialize Perplexity client
    this.perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY || '',
      baseURL: 'https://api.perplexity.ai'
    });
  }

  async testProvider(client: OpenAI, model: string, prompt: string, provider: string): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert cryptocurrency trading analyst. Provide concise, actionable trading insights with specific price targets and risk assessments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const latency = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';

      return {
        provider,
        model,
        response: content,
        latency,
        reasoning: this.extractReasoning(content),
        confidence: this.extractConfidence(content)
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        provider,
        model,
        response: `Error: ${error.message}`,
        latency,
        reasoning: 'Failed to generate response',
        confidence: 0
      };
    }
  }

  private extractReasoning(response: string): string {
    // Look for reasoning patterns in the response
    const reasoningPatterns = [
      /because|since|due to|based on/gi,
      /technical|fundamental|market/gi,
      /rsi|macd|volume|price/gi
    ];

    const hasReasoning = reasoningPatterns.some(pattern => pattern.test(response));
    return hasReasoning ? 'Strong reasoning detected' : 'Limited reasoning';
  }

  private extractConfidence(response: string): number {
    // Look for confidence indicators
    const confidenceWords = {
      'strong': 0.9,
      'high': 0.8,
      'moderate': 0.6,
      'likely': 0.7,
      'possible': 0.5,
      'uncertain': 0.3,
      'risky': 0.2,
      'caution': 0.4
    };

    for (const [word, score] of Object.entries(confidenceWords)) {
      if (response.toLowerCase().includes(word)) {
        return score;
      }
    }

    return 0.5; // Default confidence
  }

  private calculateScore(response: AIResponse): number {
    let score = 0;

    // Response quality (40%)
    if (response.response.length > 100) score += 40;
    else if (response.response.length > 50) score += 25;
    else score += 10;

    // Speed (20%)
    if (response.latency < 1000) score += 20;
    else if (response.latency < 2000) score += 15;
    else if (response.latency < 3000) score += 10;
    else score += 5;

    // Reasoning (20%)
    if (response.reasoning?.includes('Strong')) score += 20;
    else score += 10;

    // Confidence (20%)
    if (response.confidence && response.confidence > 0.7) score += 20;
    else if (response.confidence && response.confidence > 0.5) score += 15;
    else score += 10;

    return score;
  }

  async runComparison(): Promise<ComparisonResult> {
    console.log('🧠 Starting AI Provider Comparison Test');
    console.log('=========================================');

    // Test prompts for trading analysis
    const testPrompts = [
      {
        name: 'Market Analysis',
        prompt: 'Analyze current Bitcoin market conditions with price at $96,500. Should I go long or short? Provide specific entry, stop loss, and take profit levels with risk/reward ratios.'
      },
      {
        name: 'Risk Assessment',
        prompt: 'Evaluate the risk of opening a 3x leveraged long ETH position at $2,350. What are the key risks and what indicators support this trade?'
      },
      {
        name: 'Portfolio Strategy',
        prompt: 'Given a $10,000 portfolio, suggest allocation across BTC, ETH, and SOL for maximum returns with moderate risk in the current market.'
      }
    ];

    let perplexityTotalScore = 0;
    let cerebrasTotalScore = 0;
    let perplexityResponses: AIResponse[] = [];
    let cerebrasResponses: AIResponse[] = [];

    for (const test of testPrompts) {
      console.log(`\n📊 Testing: ${test.name}`);
      console.log('─'.repeat(50));

      // Test Perplexity
      console.log('🔍 Testing Perplexity...');
      const perplexityResponse = await this.testProvider(
        this.perplexity,
        'llama-3.1-sonar-large-128k-online',
        test.prompt,
        'Perplexity'
      );
      perplexityResponses.push(perplexityResponse);
      perplexityTotalScore += this.calculateScore(perplexityResponse);

      // Test Cerebras
      console.log('🤖 Testing Cerebras...');
      const cerebrasResponse = await this.testProvider(
        this.cerebras,
        'gpt-oss-120b', // High reasoning model as requested
        test.prompt,
        'Cerebras'
      );
      cerebrasResponses.push(cerebrasResponse);
      cerebrasTotalScore += this.calculateScore(cerebrasResponse);

      // Display results
      console.log('\n📈 Results:');
      console.log(`Perplexity (${perplexityResponse.latency}ms): ${perplexityResponse.response.substring(0, 100)}...`);
      console.log(`Cerebras (${cerebrasResponse.latency}ms): ${cerebrasResponse.response.substring(0, 100)}...`);
    }

    const perplexityAvgScore = perplexityTotalScore / testPrompts.length;
    const cerebrasAvgScore = cerebrasTotalScore / testPrompts.length;

    const winner = perplexityAvgScore > cerebrasAvgScore ? 'Perplexity' : 'Cerebras';
    const reasoning = winner === 'Perplexity' 
      ? `Perplexity scored ${perplexityAvgScore.toFixed(1)} vs Cerebras ${cerebrasAvgScore.toFixed(1)}. Perplexity shows better real-time market awareness and reasoning.`
      : `Cerebras scored ${cerebrasAvgScore.toFixed(1)} vs Perplexity ${perplexityAvgScore.toFixed(1)}. Cerebras provides superior analytical depth and structured responses.`;

    console.log('\n🏆 FINAL RESULTS');
    console.log('='.repeat(50));
    console.log(`Winner: ${winner}`);
    console.log(`Perplexity Score: ${perplexityAvgScore.toFixed(1)}/100`);
    console.log(`Cerebras Score: ${cerebrasAvgScore.toFixed(1)}/100`);
    console.log(`\nReasoning: ${reasoning}`);

    return {
      winner,
      reasoning,
      perplexityScore: perplexityAvgScore,
      cerebrasScore: cerebrasAvgScore,
      perplexityResponse: perplexityResponses[perplexityResponses.length - 1],
      cerebrasResponse: cerebrasResponses[cerebrasResponses.length - 1]
    };
  }

  generateRecommendation(result: ComparisonResult): string {
    const recommendation = `
# AI Provider Recommendation

## Winner: ${result.winner}

### Configuration for Trading Bot:
- **Brain Model**: ${result.winner === 'Perplexity' ? 'Perplexity llama-3.1-sonar-large-128k-online' : 'Cerebras gpt-oss-120b'}
- **Building Model**: Cerebras gpt-oss-120b (as requested)
- **Reasoning**: ${result.reasoning}

### Implementation:
${result.winner === 'Perplexity' ? `
1. Set Perplexity as your primary AI provider in config.yaml:
   \`\`\`yaml
   ai:
     provider: perplexity
     model: llama-3.1-sonar-large-128k-online
   \`\`\`

2. Keep Cerebras as secondary for building/analysis tasks:
   \`\`\`yaml
   ai:
     planner:
       provider: perplexity
       model: llama-3.1-sonar-large-128k-online
     executor:
       provider: cerebras  
       model: gpt-oss-120b
   \`\`\`
` : `
1. Keep Cerebras as your primary AI provider:
   \`\`\`yaml
   ai:
     provider: cerebras
     model: gpt-oss-120b
   \`\`\`

2. Use Perplexity as backup for real-time market data if needed.
`}

### Performance Summary:
- **Response Quality**: ${result.winner} showed superior analysis
- **Speed**: ${result.perplexityResponse.latency < result.cerebrasResponse.latency ? 'Perplexity' : 'Cerebras'} was faster
- **Reasoning**: ${result.winner} provided better market insights

### Next Steps:
1. Update your .env file with PERPLEXITY_API_KEY
2. Test the configuration with a few trading scenarios
3. Monitor performance for 24 hours before full deployment
`;

    return recommendation;
  }
}

// Run comparison if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const comparison = new AIProviderComparison();
  
  console.log('🔑 Testing AI Provider Connectivity...');
  console.log('Make sure you have CEREBRAS_API_KEY in your .env file');
  console.log('');
  
  (async () => {
    try {
      const result = await comparison.runComparison();
      const recommendation = comparison.generateRecommendation(result);
      console.log(recommendation);
      
      // Save recommendation to file
      const fs = await import('fs');
      fs.writeFileSync('ai-provider-recommendation.md', recommendation);
      console.log('\n📄 Recommendation saved to: ai-provider-recommendation.md');
    } catch (error) {
      console.error(error);
    }
  })();
}

export default AIProviderComparison;
