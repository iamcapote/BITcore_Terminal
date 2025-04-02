export const VENICE_MODELS = {
  'llama-3.3-70b': {
    availableContextTokens: 65536,
    traits: ['function_calling_default', 'default'],
    modelSource: 'https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct',
  },
  'llama-3.2-3b': {
    availableContextTokens: 131072,
    traits: ['fastest'],
    modelSource: 'https://huggingface.co/meta-llama/Llama-3.2-3B',
  },
  'dolphin-2.9.2-qwen2-72b': {
    availableContextTokens: 32768,
    traits: ['most_uncensored'],
    modelSource:
      'https://huggingface.co/cognitivecomputations/dolphin-2.9.2-qwen2-72b',
  },
  'llama-3.1-405b': {
    availableContextTokens: 63920,
    traits: ['most_intelligent'],
    modelSource:
      'https://huggingface.co/meta-llama/Meta-Llama-3.1-405B-Instruct',
  },
  qwen32b: {
    availableContextTokens: 131072,
    traits: ['default_code'],
    modelSource: 'https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct-GGUF',
  },
  'deepseek-r1-llama-70b': {
    availableContextTokens: 65536,
    traits: [],
    modelSource:
      'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  },
  'deepseek-r1-671b': {
    availableContextTokens: 131072,
    traits: [],
    modelSource: 'https://huggingface.co/deepseek-ai/DeepSeek-R1',
  },
};

export function isValidModel(model) {
  return Object.prototype.hasOwnProperty.call(VENICE_MODELS, model);
}
