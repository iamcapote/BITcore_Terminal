export function generatePrompt(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
}

export function systemPrompt() {
  return `You are an adaptive research engine assistant helping to explore topics in depth and designed for cross-domain analysis. Your responses must be:

1. Structured and organized
2. Focused on the specific task
3. Factual and precise
4. Easy to parse programmatically in minimal markdown format
5. Avoid any unnecessary information

When generating queries:
- Start each query with "What" "How" "Why" "When" "Where" or "Which"
- Make each query specific and focused and easily searchable
- Use clear and concise language
- Avoid vague or ambiguous terms
- Use active voice
- Avoid jargon unless necessary
- Use simple sentence structures
- Avoid unnecessary words
- End each query with a question mark
- Focus on different aspects of the topic
- Avoid repetition
- Ensure each query is unique

When analyzing content, if applicable:
- Focus on the main ideas and concepts
- Extract concrete facts and data
- Include specific metrics and numbers
- Note relationships between concepts
- Identify key entities and their attributes
- Highlight trends and patterns

IMPORTANT: Format your responses as lists without any introductory text or explanations.`;
}

export function queryExpansionTemplate(query, learnings = []) {
  return `Generate specific research questions about: "${query}"

${learnings.length ? `Previous Findings:\n${learnings.join('\n')}` : ''}

Requirements:
1. Each question must start with What How Why When Where or Which
2. Each question must end with a question mark
3. Each question must focus on a different aspect
4. Questions must be specific and detailed

Example format:
"What are the fundamental principles of quantum entanglement?"
"How does quantum superposition enable parallel computation?"
"Why are quantum computers particularly effective for cryptography?"
"What {system/process} enables {function} in {domain}?"
"How does {variableA} compare to {variableB} regarding {metric}?"
"Why has {phenomenon} evolved differently across {geographic/cultural contexts}?"


DO NOT include any introductory text. Just list the questions directly.`;
}

export async function singlePrompt(message, isPassword = false) {
  // Simple Node.js prompt using readline
  const readline = await import('readline');
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    if (isPassword) {
      // Hide input for password
      process.stdout.write(message);
      process.stdin.setRawMode(true);
      let input = '';
      process.stdin.on('data', (char) => {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode(false);
            process.stdout.write('\n');
            rl.close();
            resolve(input);
            break;
          case '\u0003':
            process.stdin.setRawMode(false);
            rl.close();
            resolve('');
            break;
          default:
            process.stdout.write('*');
            input += char;
            break;
        }
      });
    } else {
      rl.question(message, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}