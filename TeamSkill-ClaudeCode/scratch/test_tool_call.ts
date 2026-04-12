import Anthropic from '@anthropic-ai/sdk';

async function testToolCalling(modelName: string) {
  console.log(`\n--- Testing ${modelName} Tool Calling ---`);
  
  const client = new Anthropic({
    apiKey: 'sk-litellm-teamcc-local',
    baseURL: 'http://127.0.0.1:4000',
  });

  try {
    const msg = await client.messages.create({
      model: modelName,
      max_tokens: 500,
      messages: [{ role: 'user', content: 'Use the Bash tool to run the command: ls -la /tmp' }],
      tools: [
        {
          name: 'Bash',
          description: 'Run shell command',
          input_schema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The command to execute'
              }
            },
            required: ['command']
          }
        }
      ],
      headers: {
        'x-api-key': 'sk-litellm-teamcc-local'
      }
    });

    console.log(JSON.stringify(msg.content, null, 2));
    
  } catch (e: any) {
    console.error(`❌ Failed for ${modelName}:`, e.message);
    if (e.response && e.response.data) {
      console.error(e.response.data);
    }
  }
}

async function main() {
  await testToolCalling('deepseek-chat');
  await testToolCalling('minimax2.7');
}

main();
