import Anthropic from '@anthropic-ai/sdk';

async function testProvider(modelName: string) {
  console.log(`\nTesting ${modelName} via LiteLLM...`);
  
  const client = new Anthropic({
    apiKey: 'sk-litellm-teamcc-local', // Key defined in .env.litellm
    baseURL: 'http://127.0.0.1:4000', // LiteLLM proxy URL
  });

  try {
    const msg = await client.messages.create({
      model: modelName,
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      // Required headers to pass Anthropic SDK validations
      headers: {
        'x-api-key': 'sk-litellm-teamcc-local'
      }
    });

    if (msg.type === 'message') {
      console.log(`✅ Success for ${modelName}! Response: "${msg.content[0].type === 'text' ? msg.content[0].text : 'mixed content'}"`);
    }
  } catch (e: any) {
    console.error(`❌ Failed for ${modelName}:`, e.message);
    if (e.response && e.response.data) {
      console.error(e.response.data);
    }
  }
}

async function main() {
  await testProvider('deepseek-chat');
  await testProvider('minimax2.7');
}

main();
