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