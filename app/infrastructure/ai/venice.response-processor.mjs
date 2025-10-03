/**
 * Why: Normalise Venice LLM responses so downstream memory and chat pipelines can consume structured data reliably.
 * What: Provides helpers to extract JSON/markdown payloads, clean chat transcripts, and shape memory scoring/summarisation outputs.
 * How: Applies lightweight parsing heuristics with guarded error handling and emits structured logs when parsing fails.
 */

import { createModuleLogger } from '../../utils/logger.mjs';

const logger = createModuleLogger('venice.response-processor');

/**
 * Extract structured data from an LLM response
 * 
 * @param {string} text - Raw LLM response text
 * @param {Object} options - Processing options
 * @param {string} options.format - Expected format ('json', 'markdown', 'text')
 * @param {boolean} options.strictMode - Whether to throw error on parse failure
 * @returns {Object} Parsed response object
 */
export function extractStructuredData(text, options = {}) {
  const { format = 'json', strictMode = false } = options;
  
  try {
    if (format === 'json') {
      return extractJson(text, strictMode);
    } else if (format === 'markdown') {
      return extractMarkdown(text, strictMode);
    } else {
      return { content: text, format: 'text' };
    }
  } catch (error) {
    if (strictMode) {
      throw new Error(`Failed to extract structured data: ${error.message}`);
    }
    return { content: text, format: 'text', parseError: error.message };
  }
}

/**
 * Extract JSON data from text
 * 
 * @param {string} text - Text containing JSON
 * @param {boolean} strictMode - Whether to throw error on parse failure
 * @returns {Object} Parsed JSON object
 */
function extractJson(text, strictMode = false) {
  try {
    // Try to find JSON block in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch && strictMode) {
      throw new Error('No valid JSON object found in response');
    } else if (!jsonMatch) {
      return { content: text, format: 'text' };
    }
    
    const jsonText = jsonMatch[0];
    const parsed = JSON.parse(jsonText);
    return { ...parsed, format: 'json', raw: text };
  } catch (error) {
    if (strictMode) {
      throw error;
    }
    return { content: text, format: 'text', parseError: error.message };
  }
}

/**
 * Extract structured data from markdown text
 * 
 * @param {string} text - Markdown text
 * @param {boolean} strictMode - Whether to throw error on parse failure
 * @returns {Object} Structured data from markdown
 */
function extractMarkdown(text, strictMode = false) {
  try {
    const sections = {};
    
    // Split by markdown headings
    const headerSections = text.split(/^#+\s+(.*)/m).filter(Boolean);
    
    if (headerSections.length <= 1) {
      // No clear markdown structure, return as plain text
      return { content: text, format: 'markdown' };
    }
    
    // Process sections
    for (let i = 0; i < headerSections.length; i += 2) {
      if (i + 1 < headerSections.length) {
        const heading = headerSections[i].trim();
        const content = headerSections[i + 1].trim();
        sections[heading] = content;
      }
    }
    
    return { sections, format: 'markdown', raw: text };
  } catch (error) {
    if (strictMode) {
      throw error;
    }
    return { content: text, format: 'text', parseError: error.message };
  }
}

/**
 * Process memory scoring response
 * 
 * @param {string} response - Raw LLM response
 * @returns {Array} Array of memory evaluations
 */
export function processMemoryScoring(response) {
  try {
    const data = extractStructuredData(response, { format: 'json' });
    
    // Check if we have valid memory evaluations
    if (data.format !== 'json' || !data.memories || !Array.isArray(data.memories)) {
      throw new Error('Invalid memory evaluation format');
    }
    
    // Validate and normalize each memory evaluation
    return data.memories.map(memory => {
      if (!memory.id) {
        throw new Error('Memory evaluation missing ID');
      }
      
      return {
        id: memory.id,
        score: typeof memory.score === 'number' ? memory.score : 0.5,
        tags: Array.isArray(memory.tags) ? memory.tags : [],
        action: ['retain', 'summarize', 'discard'].includes(memory.action) 
          ? memory.action 
          : 'retain'
      };
    });
  } catch (error) {
    logger.error('Error processing memory scoring', { message: error.message, stack: error.stack });
    return [];
  }
}

/**
 * Process memory summarization response
 * 
 * @param {string} response - Raw LLM response
 * @returns {Array} Array of memory summaries
 */
export function processMemorySummarization(response) {
  try {
    const data = extractStructuredData(response, { format: 'json' });
    
    // Check if we have valid summaries
    if (data.format !== 'json' || !data.summaries || !Array.isArray(data.summaries)) {
      throw new Error('Invalid memory summarization format');
    }
    
    // Validate and normalize each summary
    return data.summaries.map(summary => {
      if (!summary.content) {
        throw new Error('Memory summary missing content');
      }
      
      return {
        content: summary.content,
        tags: Array.isArray(summary.tags) ? summary.tags : [],
        importance: typeof summary.importance === 'number' ? summary.importance : 0.5
      };
    });
  } catch (error) {
    logger.error('Error processing memory summarization', { message: error.message, stack: error.stack });
    return [];
  }
}

/**
 * Clean and format chat responses
 * 
 * @param {string} response - Raw LLM response
 * @returns {string} Cleaned and formatted response
 */
export function cleanChatResponse(response) {
  // Remove any JSON formatting artifacts that might appear
  const cleaned = response
    .replace(/^```(json|javascript)\s*/, '')
    .replace(/```$/, '')
    .trim();
  
  // If it looks like JSON, try to extract just textual content
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.content) return parsed.content;
      if (parsed.response) return parsed.response;
      if (parsed.message) return parsed.message;
      if (parsed.text) return parsed.text;
    } catch (e) {
      // Not valid JSON, return as is
    }
  }
  
  return response;
}

export function processAIResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response');
  }

  const { content, model, timestamp } = response;
  if (!content || !model || !timestamp) {
    throw new Error('Incomplete response');
  }

  return {
    content,
    model,
    timestamp,
  };
}

export class BaseProcessor {
  cleanText(text) {
    return text
      .replace(/^[\d\-\*•]+\.?\s*/, '') // Remove list markers
      .replace(/^[1-9][0-9]?\.\s*/, '') // Remove numbered list markers
      .replace(/^\-\s*/, '') // Remove bullet points
      .trim();
  }

  extractLines(text) {
    return text
      .split('\n')
      .map(line => this.cleanText(line))
      .filter(line => line.length > 0);
  }
}

export class QueryProcessor extends BaseProcessor {
  process(content) {
    const questions = this.extractLines(content)
      .filter(line => line.includes('?'))
      .filter(line => line.match(/^(what|how|why|when|where|which)/i));

    if (questions.length > 0) {
      return {
        rawContent: content,
        success: true,
        queries: questions.map(query => ({
          query,
          researchGoal: `Research and analyze: ${query.replace(/\?$/, '')}`,
        })),
      };
    }

    return {
      rawContent: content,
      success: false,
      error: 'No valid questions found',
      queries: [],
    };
  }
}

export class LearningProcessor extends BaseProcessor {
  process(content) {
    const lines = this.extractLines(content);
    const learnings = lines.filter(line => !line.includes('?'));
    const questions = lines.filter(line => line.includes('?'));

    return {
      rawContent: content,
      success: true,
      learnings,
      followUpQuestions: questions,
    };
  }
}

export class ReportProcessor extends BaseProcessor {
  process(content) {
    if (!content.trim()) {
      return {
        rawContent: content,
        success: false,
        error: 'Empty content',
        reportMarkdown: '',
      };
    }

    return {
      rawContent: content,
      success: true,
      reportMarkdown: content,
    };
  }
}