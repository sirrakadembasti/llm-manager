import net from 'node:net';
export const PROVIDERS = Object.freeze([
  {
    id: 'openai',
    name: 'OpenAI',
    region: 'ABD',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3', 'o4-mini', 'gpt-4o', 'gpt-4o-mini']
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    region: 'ABD',
    transport: 'anthropic',
    capabilities: { thinking: true },
    baseURL: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-7-sonnet-latest',
      'claude-3-5-haiku-latest'
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    region: 'ABD',
    transport: 'google',
    capabilities: { thinking: true },
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
  },
  {
    id: 'xai',
    name: 'xAI',
    region: 'ABD',
    transport: 'openai',
    baseURL: 'https://api.x.ai/v1',
    models: ['grok-3', 'grok-3-mini', 'grok-2-latest']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    region: 'ABD',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-pro', 'deepseek/deepseek-r1']
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    region: 'ABD',
    transport: 'openai',
    baseURL: 'https://api.perplexity.ai',
    models: ['sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning']
  },
  {
    id: 'groq',
    name: 'Groq',
    region: 'ABD',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b']
  },
  {
    id: 'together',
    name: 'Together AI',
    region: 'ABD',
    transport: 'openai',
    baseURL: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct-Turbo']
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    region: 'ABD',
    transport: 'openai',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    models: [
      'accounts/fireworks/models/deepseek-v3',
      'accounts/fireworks/models/deepseek-r1',
      'accounts/fireworks/models/llama-v3p3-70b-instruct'
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    region: 'Kanada',
    transport: 'openai',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    models: ['command-a-03-2025', 'command-r-plus-08-2024', 'command-r-08-2024']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    region: 'Çin',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://api.deepseek.com',
    endpoints: [
      { name: 'Standart (api.deepseek.com)', baseURL: 'https://api.deepseek.com' },
      { name: 'v1 Uyumlu (api.deepseek.com/v1)', baseURL: 'https://api.deepseek.com/v1' }
    ],
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    region: 'Çin',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    endpoints: [
      {
        name: 'Uluslararası / Singapur (dashscope-intl)',
        baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      },
      { name: 'ABD / Virginia (dashscope-us)', baseURL: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1' },
      { name: 'Çin / Pekin (dashscope)', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' }
    ],
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b-a22b', 'qwq-plus']
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://api.moonshot.ai/v1',
    endpoints: [
      { name: 'Küresel (api.moonshot.ai)', baseURL: 'https://api.moonshot.ai/v1' },
      { name: 'Çin (api.moonshot.cn)', baseURL: 'https://api.moonshot.cn/v1' }
    ],
    models: ['kimi-k2-0711-preview', 'kimi-latest', 'moonshot-v1-auto']
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://api.minimax.io/v1',
    endpoints: [
      { name: 'Küresel (api.minimax.io)', baseURL: 'https://api.minimax.io/v1' },
      { name: 'Çin (api.minimaxi.com)', baseURL: 'https://api.minimaxi.com/v1' }
    ],
    models: ['MiniMax-M1', 'MiniMax-Text-01', 'abab6.5s-chat']
  },
  {
    id: 'zhipu',
    name: 'Zhipu GLM',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    endpoints: [
      { name: 'BigModel Çin (open.bigmodel.cn)', baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
      { name: 'Z.ai Küresel (api.z.ai)', baseURL: 'https://api.z.ai/api/paas/v4' }
    ],
    models: ['glm-4.5', 'glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-z1-air']
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://api.siliconflow.cn/v1',
    endpoints: [
      { name: 'Çin (api.siliconflow.cn)', baseURL: 'https://api.siliconflow.cn/v1' },
      { name: 'Küresel (api.siliconflow.com)', baseURL: 'https://api.siliconflow.com/v1' }
    ],
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct']
  },
  {
    id: 'baidu',
    name: 'Baidu Qianfan',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.5-turbo-128k', 'ernie-4.0-turbo-8k', 'ernie-speed-128k', 'deepseek-v3']
  },
  {
    id: 'doubao',
    name: 'ByteDance Doubao',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-1-6-250615', 'doubao-1-5-pro-32k-250115', 'doubao-1-5-lite-32k-250115', 'deepseek-r1-250120']
  },
  {
    id: 'hunyuan',
    name: 'Tencent Hunyuan',
    region: 'Çin',
    transport: 'openai',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-turbos-latest', 'hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite']
  },
  {
    id: 'xiaomi_mimo',
    name: 'Xiaomi MiMo',
    region: 'Çin',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'https://api.xiaomimimo.com/v1',
    endpoints: [
      { name: 'PAYG', baseURL: 'https://api.xiaomimimo.com/v1' },
      ...['cn', 'sgp', 'ams'].map(region => ({
        name: 'Token Plan ' + region.toUpperCase(),
        baseURL: `https://token-plan-${region}.xiaomimimo.com/v1`
      }))
    ],
    models: ['mimo-v2.6-pro', 'mimo-v2.6-flash', 'mimo-v2.5-pro', 'mimo-v2.5']
  },
  {
    id: 'ollama',
    name: 'Ollama (Yerel / LAN)',
    region: 'Yerel',
    transport: 'openai',
    capabilities: { thinking: true },
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3.2', 'deepseek-r1', 'qwen2.5', 'mistral', 'phi4'],
    note: 'Yerel bağlantı için allowLocalHttp: true veya LAN için allowedPrivateHosts gereklidir.'
  },
  {
    id: 'custom',
    name: 'Özel OpenAI uyumlu',
    region: 'Özel',
    transport: 'openai',
    baseURL: '',
    models: []
  }
]);

const disallowedHost = /(^|\.)(localhost|local|internal)$/i;
export function validateProviderUrl(value, { allowLocalHttp = false, allowedPrivateHosts = [] } = {}) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('Geçerli bir API adresi girin.');
  }
  if (url.username || url.password) throw new Error('API adresinde kimlik bilgisi bulunamaz.');
  if (url.search || url.hash) throw new Error('API adresinde sorgu veya parça bulunamaz.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const privateList = [
    ...(allowedPrivateHosts || []),
    ...(process.env.LLM_ALLOWED_PRIVATE_HOSTS ? process.env.LLM_ALLOWED_PRIVATE_HOSTS.split(',') : [])
  ]
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);

  const isAllowedPrivate = privateList.some(h => h === url.host.toLowerCase() || h === host.toLowerCase());

  const local = disallowedHost.test(host) || host === '127.0.0.1' || host === '::1';
  const ip = net.isIP(host);
  if (isAllowedPrivate) {
    return url.toString().replace(/\/$/, '');
  }
  if (local && !(allowLocalHttp && url.protocol === 'http:')) throw new Error('Yerel API adresi kapalıdır.');
  if (ip && !allowLocalHttp) throw new Error('IP adresine doğrudan bağlantı kapalıdır.');
  if (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:'))
    throw new Error('API adresi HTTPS kullanmalıdır.');
  return url.toString().replace(/\/$/, '');
}
