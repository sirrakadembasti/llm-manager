import net from 'node:net';
export const PROVIDERS = Object.freeze([
  { id: 'openai', name: 'OpenAI', region: 'ABD', transport: 'openai', baseURL: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic', region: 'ABD', transport: 'anthropic', baseURL: 'https://api.anthropic.com/v1' },
  { id: 'google', name: 'Google Gemini', region: 'ABD', transport: 'google', baseURL: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'xai', name: 'xAI', region: 'ABD', transport: 'openai', baseURL: 'https://api.x.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', region: 'ABD', transport: 'openai', baseURL: 'https://openrouter.ai/api/v1' },
  { id: 'perplexity', name: 'Perplexity', region: 'ABD', transport: 'openai', baseURL: 'https://api.perplexity.ai' },
  { id: 'groq', name: 'Groq', region: 'ABD', transport: 'openai', baseURL: 'https://api.groq.com/openai/v1' },
  { id: 'together', name: 'Together AI', region: 'ABD', transport: 'openai', baseURL: 'https://api.together.xyz/v1' },
  { id: 'fireworks', name: 'Fireworks AI', region: 'ABD', transport: 'openai', baseURL: 'https://api.fireworks.ai/inference/v1' },
  { id: 'cohere', name: 'Cohere', region: 'Kanada', transport: 'openai', baseURL: 'https://api.cohere.ai/compatibility/v1' },
  { id: 'deepseek', name: 'DeepSeek', region: 'Çin', transport: 'openai', baseURL: 'https://api.deepseek.com' },
  { id: 'qwen', name: 'Alibaba Qwen', region: 'Çin', transport: 'openai', baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
  { id: 'kimi', name: 'Moonshot Kimi', region: 'Çin', transport: 'openai', baseURL: 'https://api.moonshot.ai/v1' },
  { id: 'minimax', name: 'MiniMax', region: 'Çin', transport: 'openai', baseURL: 'https://api.minimax.io/v1' },
  { id: 'zhipu', name: 'Zhipu GLM', region: 'Çin', transport: 'openai', baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'siliconflow', name: 'SiliconFlow', region: 'Çin', transport: 'openai', baseURL: 'https://api.siliconflow.cn/v1' },
  { id: 'baidu', name: 'Baidu Qianfan', region: 'Çin', transport: 'openai', baseURL: 'https://qianfan.baidubce.com/v2' },
  { id: 'doubao', name: 'ByteDance Doubao', region: 'Çin', transport: 'openai', baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'hunyuan', name: 'Tencent Hunyuan', region: 'Çin', transport: 'openai', baseURL: 'https://api.hunyuan.cloud.tencent.com/v1' },
  {
    id: 'xiaomi_mimo',
    name: 'Xiaomi MiMo',
    region: 'Çin',
    transport: 'openai',
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
  { id: 'custom', name: 'Özel OpenAI uyumlu', region: 'Özel', transport: 'openai', baseURL: '' }
]);

const disallowedHost = /(^|\.)(localhost|local|internal)$/i;
export function validateProviderUrl(value, { allowLocalHttp = false } = {}) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new Error('Geçerli bir API adresi girin.'); }
  if (url.username || url.password) throw new Error('API adresinde kimlik bilgisi bulunamaz.');
  if (url.search || url.hash) throw new Error('API adresinde sorgu veya parça bulunamaz.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = disallowedHost.test(host) || host === '127.0.0.1' || host === '::1';
  const ip = net.isIP(host);
  if (local && !(allowLocalHttp && url.protocol === 'http:')) throw new Error('Yerel API adresi kapalıdır.');
  if (ip && !allowLocalHttp) throw new Error('IP adresine doğrudan bağlantı kapalıdır.');
  if (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:')) throw new Error('API adresi HTTPS kullanmalıdır.');
  return url.toString().replace(/\/$/, '');
}
