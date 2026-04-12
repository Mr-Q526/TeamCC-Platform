import Anthropic from '@anthropic-ai/sdk';

async function main() {
  console.log('Testing Anthropic client against Minimax...');
  
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });

  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'minimax2.7',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hello' }],
    });
    console.log('Success!', msg);
  } catch (e: any) {
    if (e.status === 404) {
      console.log('404 Not Found. This means the /v1/messages endpoint does not exist on Minimax.');
    }
    console.error('API Error:', e.name, e.message);
  }
}

main();
