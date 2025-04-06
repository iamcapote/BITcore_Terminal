import { LLMClient } from '../../infrastructure/ai/venice.llm-client.mjs';
import { systemPrompt, queryExpansionTemplate } from '../../utils/research.prompt.mjs';

function processQueryResponse(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const queries = lines.filter(line => line.match(/^(What|How|Why|When|Where|Which)/i));
  if (queries.length > 0) {
    return { success: true, queries };
  }
  return { success: false, error: 'No questions found.' };
}

function processLearningResponse(rawText) {
  const learningsMatch = rawText.match(/Key Learnings:\s*([\s\S]*?)\n\n/);
  const questionsMatch = rawText.match(/Follow-up Questions:\s*([\s\S]*)/);

  const learnings = learningsMatch ? 
    learningsMatch[1].split('\n').map(l => l.trim()).filter(Boolean) : [];
  const followUpQuestions = questionsMatch ? 
    questionsMatch[1].split('\n').map(l => l.trim()).filter(Boolean) : [];

  if (learnings.length || followUpQuestions.length) {
    return { success: true, learnings, followUpQuestions };
  }
  return { success: false, error: 'No valid learnings or questions found.' };
}

function processReportResponse(rawText) {
  if (!rawText.trim()) {
    return { success: false, error: 'Empty report text' };
  }
  return { success: true, reportMarkdown: rawText };
}

function processResponse(type, content) {
  switch (type) {
    case 'query':
      return processQueryResponse(content);
    case 'learning':
      return processLearningResponse(content);
    case 'report':
      return processReportResponse(content);
    default:
      return { success: false, error: 'Unknown type' };
  }
}

export async function generateOutput({ type, system, prompt, temperature = 0.7, maxTokens = 1000 }) {
  const client = new LLMClient({});
  try {
    const response = await client.complete({
      system,
      prompt,
      temperature,
      maxTokens
    });

    let parsed = processResponse(type, response.content);
    if (parsed.success) {
      return { success: true, data: parsed };
    }

    const fallbackResponse = await client.complete({
      system,
      prompt: `${prompt}\n\nPlease ensure your response is structured clearly:\n- Key points on new lines\n- Provide meaningful statements`,
      temperature: 0.5
    });
    parsed = processResponse(type, fallbackResponse.content);
    if (parsed.success) {
      return { success: true, data: parsed };
    }

    return { success: false, error: parsed.error };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Update the generateQueries function to properly use the metadata
export async function generateQueries({ query, numQueries = 3, learnings = [], metadata = null }) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Invalid query: must be a non-empty string.');
  }

  // Create an enriched prompt that includes metadata if available
  let enrichedPrompt = queryExpansionTemplate(query, learnings);
  if (metadata) {
    // Better integration of token classification metadata into the prompt
    enrichedPrompt = `${enrichedPrompt}\n\nAdditional context from query analysis:\n${metadata}\n\nPlease use this additional context to generate more precise and targeted questions that would better explore the subject, even if the original query is unclear or incomplete.`;
  }

  const result = await generateOutput({
    type: 'query',
    system: systemPrompt(),
    prompt: enrichedPrompt,
    temperature: 0.7,
    maxTokens: 1000
  });

  if (result.success) {
    const lines = result.data.queries || [];
    return lines.slice(0, numQueries).map(q => ({
      query: q.trim(),
      researchGoal: `Research: ${q.trim()}`
    }));
  }

  // Fallback with a basic query
  return [
    {
      query: `What are the key aspects of ${query}?`,
      researchGoal: `Research and analyze: ${query}`
    }
  ];
}

// Also update processResults to use metadata
export async function processResults({ query, content, numLearnings = 3, numFollowUpQuestions = 3, metadata = null }) {
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Invalid content: must be a non-empty array of strings.');
  }

  // Build a prompt that better incorporates metadata if available
  let analysisPrompt = `Analyze the following content about "${query}":\n\n`;
  
  // More effective use of metadata to guide analysis
  if (metadata) {
    analysisPrompt += `Context from query analysis:\n${metadata}\n\nUse this context to better interpret the query "${query}" and extract the most relevant information from the content below, even if the original query seems unclear.\n\n`;
  }
  
  analysisPrompt += `Content:\n${content.map(txt => `---\n${txt}\n---`).join('\n')}\n\n`;
  analysisPrompt += `Extract:\n1. Key Learnings (at least ${numLearnings}):\n   - Focus on specific facts, data points\n2. Follow-up Questions (at least ${numFollowUpQuestions}):\n   - Must start with What, How, Why, When, Where, or Which\n\nFormat as:\nKey Learnings:\n1. ...\n2. ...\nFollow-up Questions:\n1. ...\n2. ...`;

  const result = await generateOutput({
    type: 'learning',
    system: systemPrompt(),
    prompt: analysisPrompt,
    temperature: 0.5
  });

  if (result.success) {
    return {
      learnings: (result.data.learnings || []).slice(0, numLearnings),
      followUpQuestions: (result.data.followUpQuestions || []).slice(0, numFollowUpQuestions)
    };
  }

  throw new Error(`Failed to process: ${result.error}`);
}

// Update generateSummary to leverage metadata too
export async function generateSummary({ query, learnings = [], metadata = null }) {
  let prompt = `Write a comprehensive narrative summary about "${query}" based on:\n`;
  
  if (metadata) {
    prompt += `Context from query analysis:\n${metadata}\n\n`;
  }
  
  prompt += `${learnings.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\n`;
  prompt += `Include:\n1. Clear structure\n2. Logical organization\n3. Technical accuracy\n`;

  const result = await generateOutput({
    type: 'report',
    system: systemPrompt(),
    prompt,
    temperature: 0.7
  });

  if (result.success) {
    return result.data.reportMarkdown;
  }
  return 'No summary generated.';
}

export function trimPrompt(text = '', maxLength = 100000) {
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}
