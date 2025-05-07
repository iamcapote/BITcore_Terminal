export const VENICE_MODELS = {
  'llama-3.2-3b': {
    availableContextTokens: 131072,
    traits: ['fastest'],
    modelSource: 'https://huggingface.co/meta-llama/Llama-3.2-3B',
  },
  'llama-3.3-70b': {
    availableContextTokens: 65536,
    traits: ['function_calling_default', 'default'],
    modelSource: 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct',
  },
  'llama-3.1-405b': {
    availableContextTokens: 65536,
    traits: ['most_intelligent'],
    modelSource: 'https://huggingface.co/meta-llama/Meta-Llama-3.1-405B-Instruct',
  },
  'llama-4-maverick-17b': {
    availableContextTokens: 262144,
    traits: [],
    modelSource: 'https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  },
  'mistral-31-24b': {
    availableContextTokens: 131072,
    traits: ['default_vision'],
    modelSource: 'https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct-2503',
  },
  'venice-uncensored': {
    availableContextTokens: 32768,
    traits: [],
    modelSource: 'https://huggingface.co/cognitivecomputations/Dolphin-Mistral-24B-Venice-Edition',
  },
  'qwen-2.5-coder-32b': {
    availableContextTokens: 32768,
    traits: ['default_code'],
    modelSource: 'https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct-GGUF',
  },
  'qwen-2.5-qwq-32b': {
    availableContextTokens: 32768,
    traits: [],
    modelSource: 'https://huggingface.co/Qwen/QwQ-32B',
  },
  'qwen-2.5-vl': {
    availableContextTokens: 32768,
    traits: [],
    modelSource: 'https://huggingface.co/Qwen/Qwen2.5-VL-72B-Instruct',
  },
  'dolphin-2.9.2-qwen2-72b': {
    availableContextTokens: 32768,
    traits: ['most_uncensored'],
    modelSource: 'https://huggingface.co/cognitivecomputations/dolphin-2.9.2-qwen2-72b',
  },
  'deepseek-r1-671b': {
    availableContextTokens: 131072,
    traits: ['default_reasoning'],
    modelSource: 'https://huggingface.co/deepseek-ai/DeepSeek-R1',
  },
  'deepseek-coder-v2-lite': {
    availableContextTokens: 131072,
    traits: [],
    modelSource: 'https://huggingface.co/deepseek-ai/deepseek-coder-v2-lite-Instruct',
  },
};

export function isValidModel(model) {
  return Object.prototype.hasOwnProperty.call(VENICE_MODELS, model);
}

export function getDefaultModelId() {
  return 'llama-3.3-70b'; // General default
}

export function getDefaultChatModelId() {
  return 'llama-3.3-70b'; // Default for chat
}

export function getDefaultResearchModelId() {
  return 'llama-3.1-405b'; // Default for research
}

export function getDefaultTokenClassifierModelId() {
  return 'llama-3.3-70b'; // Default for token classification
}
