import { LLMClient } from '../../infrastructure/ai/llm-client.mjs';

export async function generateQueries({ query, numQueries = 3 }) {
  const client = new LLMClient({});
  const prompt = `Generate ${numQueries} targeted research questions about "${query}".`;
  const response = await client.complete({
    system: 'You are a research assistant...',
    prompt,
  });
  return response.choices.map(choice => ({ query: choice.text.trim() }));
}

export async function processResults({ query, content }) {
  const client = new LLMClient({});
  const prompt = `Analyze the following content for the query "${query}":\n\n${content.join('\n\n')}`;
  const response = await client.complete({
    system: 'You are an analysis assistant...',
    prompt,
  });
  return {
    learnings: response.learnings || [],
    followUpQuestions: response.followUpQuestions || [],
  };
}
