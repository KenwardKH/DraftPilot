import type { AiConfig } from '../types/ai';

export function resolveAiConfig(input?: Request | Headers | Record<string, string | null | undefined>): AiConfig {
  let headerBaseUrl: string | null | undefined;
  let headerApiKey: string | null | undefined;
  let headerModel: string | null | undefined;

  if (input) {
    if ('headers' in input && input.headers instanceof Headers) {
      headerBaseUrl = input.headers.get('x-ai-base-url');
      headerApiKey = input.headers.get('x-ai-api-key');
      headerModel = input.headers.get('x-ai-model');
    } else if (input instanceof Headers) {
      headerBaseUrl = input.get('x-ai-base-url');
      headerApiKey = input.get('x-ai-api-key');
      headerModel = input.get('x-ai-model');
    } else if (typeof input === 'object') {
      const record = input as Record<string, string | null | undefined>;
      headerBaseUrl = record['x-ai-base-url'];
      headerApiKey = record['x-ai-api-key'];
      headerModel = record['x-ai-model'];
    }
  }

  // 1. Check if client provided custom BYOK headers
  if (headerBaseUrl && headerApiKey && headerModel) {
    return {
      baseUrl: normalizeBaseUrl(headerBaseUrl),
      apiKey: headerApiKey.trim(),
      model: headerModel.trim(),
      source: 'byok',
    };
  }

  // 2. Fall back to host environment variables (.env.local)
  const envBaseUrl = process.env.AI_BASE_URL || 'http://localhost:20128/v1';
  const envApiKey = process.env.AI_API_KEY || 'sk-9router';
  const envModel = process.env.AI_MODEL || 'gemini-2.5-flash';

  return {
    baseUrl: normalizeBaseUrl(envBaseUrl),
    apiKey: envApiKey.trim(),
    model: envModel.trim(),
    source: 'host_default',
  };
}

export function getHostDefaults(): { baseUrl: string; model: string; hasKey: boolean } {
  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || 'http://localhost:20128/v1');
  const model = (process.env.AI_MODEL || 'gemini-2.5-flash').trim();
  const hasKey = Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0);

  return { baseUrl, model, hasKey };
}

function normalizeBaseUrl(url: string): string {
  let trimmed = url.trim();
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}
