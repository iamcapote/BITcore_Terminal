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