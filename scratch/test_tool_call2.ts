import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { zodToJsonSchema } from 'zod-to-json-schema';

async function testToolCalling(modelName: string) {
  console.log(`\n--- Testing ${modelName} Tool Calling with Complex Schema ---`);
  
  const client = new Anthropic({
    apiKey: 'sk-litellm-teamcc-local',
    baseURL: 'http://127.0.0.1:4000',
  });

  const complexSchema = z.strictObject({
    command: z.string().describe('The command to execute'),
    timeout: z.number().optional().describe(`Optional timeout in milliseconds`),
    description: z.string().optional().describe(`Clear, concise description...`),
    run_in_background: z.boolean().optional().describe(`Set to true to run this command in the background.`),
    dangerouslyDisableSandbox: z.boolean().optional().describe('Set this to true to dangerously override sandbox mode.')
  });

  try {
    const msg = await client.messages.create({
      model: modelName,
      max_tokens: 500,
      messages: [{ role: 'user', content: '1.我希望使用 shift+tab能够切换到by permission模式。 \n\n Please switch my directory to /tmp' }],
      tools: [
        {
          name: 'Bash',
          description: 'Run shell command',
          input_schema: zodToJsonSchema(complexSchema) as any
        }
      ],
      headers: {
        'x-api-key': 'sk-litellm-teamcc-local'
      }
    });

    console.log(JSON.stringify(msg.content, null, 2));
    
  } catch (e: any) {
    console.error(`❌ Failed for ${modelName}:`, e.message);
  }
}

async function main() {
  await testToolCalling('deepseek-chat');
  await testToolCalling('minimax2.7');
}

main();
