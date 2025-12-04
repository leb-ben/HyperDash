/**
 * Test OpenAI API Key
 * Run: node scripts/test-openai-key.js
 */

import OpenAI from 'openai';

async function testOpenAIKey(apiKey) {
  console.log('🔑 Testing OpenAI API Key...');
  
  if (!apiKey) {
    console.log('❌ No API key provided');
    return false;
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey
    });

    console.log('📡 Making test API call...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'What is the current price of Bitcoin? (Just say "API working" if you can see this message)'
        }
      ],
      max_tokens: 50,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('✅ API Response:', content);
    console.log('📊 Usage:', response.usage);
    
    return true;
  } catch (error) {
    console.log('❌ API Error:', error.message);
    
    if (error.status === 401) {
      console.log('💡 Invalid API key - check your key');
    } else if (error.status === 429) {
      console.log('💡 Rate limit exceeded - try again later');
    } else {
      console.log('💡 Check your internet connection and API key');
    }
    
    return false;
  }
}

// Run test if called directly
const apiKey = process.env.OPENAI_API_KEY || process.argv[2];

if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenAIKey(apiKey)
    .then(success => {
      if (success) {
        console.log('\n🎉 OpenAI API key is working!');
        console.log('You can use OpenAI as a secondary AI provider if needed.');
      } else {
        console.log('\n💔 OpenAI API key test failed.');
        console.log('Please check your API key or stick with Cerebras (which is working great).');
      }
    })
    .catch(console.error);
}

export default testOpenAIKey;
