/**
 * Why: Centralize pure helper functions for research providers (string parsing, trimming, formatting).
 * What: Exports stateless utilities for prompt shaping, response parsing, and fallback logic.
 * How: No side effects; all functions are pure and reusable across controller/service layers.
 * Contract
 *   Inputs: strings/arrays describing model responses and prompts.
 *   Outputs: derived values without mutation or external IO.
 */

export function processQueryResponse(rawText) {
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
  const queries = lines
    .map((line) => line.replace(/^[\*\-\d\.]+\s*/, ''))
    .filter((line) => /^(What|How|Why|When|Where|Which)/i.test(line));
  if (queries.length > 0) {
    return { success: true, queries };
  }
  return { success: false, error: 'No valid questions found starting with What/How/Why/etc.' };
}

export function processLearningResponse(rawText) {
  const learningsMatch = rawText.match(/Key Learnings:([\s\S]*?)(Follow-up Questions:|$)/i);
  const questionsMatch = rawText.match(/Follow-up Questions:([\s\S]*)/i);

  const parseSection = (sectionText) => {
    if (!sectionText) return [];
    return sectionText
      .split('\n')
      .map((line) => line.trim().replace(/^-|^\*|^\d+\.?\s*/, '').trim())
      .filter(Boolean);
  };

  const learnings = parseSection(learningsMatch ? learningsMatch[1] : null);
  const followUpQuestions = parseSection(questionsMatch ? questionsMatch[1] : null);

  if (learnings.length > 0 || followUpQuestions.length > 0) {
    return { success: true, learnings, followUpQuestions };
  }

  if (!learningsMatch && !questionsMatch) {
    return {
      success: false,
      error: 'Could not find required sections (Key Learnings/Follow-up Questions) in the response.'
    };
  }

  if (learnings.length === 0 && followUpQuestions.length === 0) {
    return {
      success: false,
      error: 'Found learning/question sections but content was empty or invalid after cleaning.'
    };
  }

  return { success: false, error: 'Unknown error parsing learnings and questions.' };
}

export function processReportResponse(rawText) {
  if (!rawText.trim()) {
    return { success: false, error: 'Empty report text' };
  }
  return { success: true, reportMarkdown: rawText };
}

export function processResponse(type, content) {
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

export function trimPrompt(text = '', maxLength = 100000) {
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}
