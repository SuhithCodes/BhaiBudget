import { Groq } from 'groq-sdk';

// Lazily instantiate the client so importing this module (e.g. during
// `next build` page-data collection) doesn't require GROQ_API_KEY to be set.
// The key is only needed when a completion is actually requested.
let client: Groq | null = null;

export const groq: Groq = new Proxy({} as Groq, {
  get(_target, prop) {
    client ??= new Groq();
    return client[prop as keyof Groq];
  },
});

// Default model for text completions
export const TEXT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Vision model for image analysis (Llama 4 Scout supports multimodal)
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Default completion settings
export const DEFAULT_SETTINGS = {
  temperature: 0.2,
  max_tokens: 2048,
  top_p: 1,
};
