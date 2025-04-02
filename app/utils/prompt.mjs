export function generatePrompt(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || '');
  }