import { z } from 'zod';

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  source: 'byok' | 'host_default';
}

export interface AiSettings {
  isCustom: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const TestConnectionSchema = z.object({
  baseUrl: z.string().trim().url('Invalid Base URL format'),
  apiKey: z.string().trim().min(1, 'API Key is required'),
  model: z.string().trim().min(1, 'Model name is required'),
});

