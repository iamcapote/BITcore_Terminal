/**
 * Why: Provide deterministic recovery helpers when LLM calls fail during research flows.
 * What: Derives human-readable fallback topics and query lists to keep investigations moving.
 * How: Exposes pure functions consumed by the service layer without introducing side effects.
 */

export function computeFallbackTopic(query) {
  let fallbackTopic = 'the topic';
  const firstUserMessageMatch = query.match(/user:\s*(.*?)(\n|$)/i);

  if (firstUserMessageMatch && firstUserMessageMatch[1].trim()) {
    fallbackTopic = firstUserMessageMatch[1].trim();
    if (fallbackTopic.length > 50) {
      fallbackTopic = `${fallbackTopic.substring(0, 50)}...`;
    }
  } else if (query.length < 100) {
    fallbackTopic = query;
  }

  return fallbackTopic;
}

export function buildFallbackQueries(topic, targetCount) {
  const base = [
    { original: `What is ${topic}?`, metadata: { goal: `Research definition of: ${topic}` } },
    { original: `How does ${topic} work?`, metadata: { goal: `Research how ${topic} works` } },
    { original: `Examples of ${topic}`, metadata: { goal: `Research examples of: ${topic}` } }
  ];

  while (base.length < (Number(targetCount) || 3)) {
    base.push({
      original: `Which aspects of ${topic} are most important?`,
      metadata: { goal: `Explore key aspects of: ${topic}` }
    });
  }

  return base.slice(0, targetCount);
}
