import OpenAI from 'openai';
import { env } from '../env.js';

// Create singleton OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not configured, AI parsing will not be available');
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

/**
 * Parse text using OpenAI GPT-4o
 * @param text - The text to parse
 * @param prompt - The system prompt describing what to extract
 * @param schema - JSON schema for the expected output structure
 * @returns Parsed data as JSON
 */
export async function parseTextWithAI<T = any>(
  text: string,
  prompt: string,
  schema: any
): Promise<T> {
  const client = getOpenAIClient();

  if (!client) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in .env file.');
  }

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'parsed_data',
        strict: true,
        schema,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content) as T;
}
