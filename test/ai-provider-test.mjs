import { resolveAiConfig, getHostDefaults } from '../src/lib/ai/provider.ts';

try {
  // 1. Test Host Defaults fallback
  process.env.AI_BASE_URL = 'http://localhost:20128/v1/';
  process.env.AI_API_KEY = 'sk-test-host-key';
  process.env.AI_MODEL = 'gemini-2.5-flash';

  const defaultCfg = resolveAiConfig();
  if (defaultCfg.source !== 'host_default') {
    throw new Error(`Expected source to be 'host_default', got '${defaultCfg.source}'`);
  }
  if (defaultCfg.baseUrl !== 'http://localhost:20128/v1') {
    throw new Error(`Expected trailing slash to be trimmed, got '${defaultCfg.baseUrl}'`);
  }
  if (defaultCfg.model !== 'gemini-2.5-flash') {
    throw new Error(`Expected model 'gemini-2.5-flash', got '${defaultCfg.model}'`);
  }

  // 2. Test Client BYOK Header Override
  const customHeaders = {
    'x-ai-base-url': 'https://openrouter.ai/api/v1///',
    'x-ai-api-key': 'sk-or-custom-key',
    'x-ai-model': 'meta-llama/llama-3.3-70b',
  };

  const byokCfg = resolveAiConfig(customHeaders);
  if (byokCfg.source !== 'byok') {
    throw new Error(`Expected source to be 'byok', got '${byokCfg.source}'`);
  }
  if (byokCfg.baseUrl !== 'https://openrouter.ai/api/v1') {
    throw new Error(`Expected normalized baseUrl 'https://openrouter.ai/api/v1', got '${byokCfg.baseUrl}'`);
  }
  if (byokCfg.apiKey !== 'sk-or-custom-key') {
    throw new Error(`Expected custom API key, got '${byokCfg.apiKey}'`);
  }
  if (byokCfg.model !== 'meta-llama/llama-3.3-70b') {
    throw new Error(`Expected custom model, got '${byokCfg.model}'`);
  }

  // 3. Test Host Defaults public inspector (zero secrets leaked)
  const hostInfo = getHostDefaults();
  if (!hostInfo.hasKey) {
    throw new Error('Expected hasKey to be true when process.env.AI_API_KEY is populated');
  }
  if ('apiKey' in hostInfo) {
    throw new Error('Security violation: getHostDefaults leaked apiKey field!');
  }

  console.log('✅ AI Provider Resolver & BYOK configuration tests PASSED successfully!');
} catch (error) {
  console.error('❌ AI provider test failed:', error);
  process.exit(1);
}

