/**
 * Test OpenAI API Key
 * Run: npx ts-node scripts/test-openai.ts
 */
import OpenAI from 'openai';
import { config } from 'dotenv';

config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

console.log('🔑 Testing OpenAI API key...\n');

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function testModels() {
  const testPrompt = 'What is 2+2? Reply with just the number.';
  
  // Test models in order of availability
  const modelsToTest = [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'o1-mini', name: 'o1 Mini (Reasoning)' },
  ];

  console.log('Testing available models:\n');
  
  for (const model of modelsToTest) {
    try {
      const start = Date.now();
      
      if (model.id.startsWith('o1')) {
        // Reasoning models use different params
        const completion = await openai.chat.completions.create({
          model: model.id,
          messages: [{ role: 'user', content: testPrompt }],
          max_completion_tokens: 100,
        });
        
        const latency = Date.now() - start;
        console.log(`✅ ${model.name}: "${completion.choices[0]?.message?.content}" (${latency}ms)`);
        console.log(`   Tokens: ${completion.usage?.total_tokens || 'N/A'}`);
      } else {
        const completion = await openai.chat.completions.create({
          model: model.id,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 10,
          temperature: 0.1
        });
        
        const latency = Date.now() - start;
        console.log(`✅ ${model.name}: "${completion.choices[0]?.message?.content}" (${latency}ms)`);
        console.log(`   Tokens: ${completion.usage?.total_tokens || 'N/A'}`);
      }
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`⚠️  ${model.name}: Not available on your plan`);
      } else if (error.status === 429) {
        console.log(`⚠️  ${model.name}: Rate limited`);
      } else {
        console.log(`❌ ${model.name}: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('\n📋 Summary: Your API key is working! Available models shown with ✅');
}

testModels().catch(console.error);
