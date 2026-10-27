import { LLMError, ErrorCodes } from '../errors.js';
export default {
  id: 'google',

  authHeaders(profile) {
    return { 'x-goog-api-key': profile.apiKey };
  },

  chatEndpoint(profile) {
    const modelId = String(profile.model).replace(/^models\//, '');
    return `models/${encodeURIComponent(modelId)}:generateContent`;
  },

  streamEndpoint(profile) {
    const modelId = String(profile.model).replace(/^models\//, '');
    return `models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;
  },

  normalizeMessages(messages, _profile) {
    if (!Array.isArray(messages) || !messages.length) return messages;

    const nonSystem = messages.filter(m => m.role !== 'system');
    const merged = [];

    for (const msg of nonSystem) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role) {
        last.content = `${last.content}\n\n${msg.content}`;
      } else {
        merged.push({ role: msg.role, content: msg.content });
      }
    }

    return merged;
  },

  buildBody(profile, messages, opts = {}) {
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    const normalized = this.normalizeMessages(messages, profile);
    const contents = normalized.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const generationConfig = { maxOutputTokens: opts.maxOutputTokens };
    const thinkingLevel = /^gemini-[34](?:[.-]|$)/.test(String(profile.model).replace(/^models\//, ''));
    if (
      opts.thinking === 'disabled' &&
      (thinkingLevel || /^gemini-2\.5-pro/.test(String(profile.model).replace(/^models\//, '')))
    ) {
      throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Bu Gemini modelinde düşünme tamamen kapatılamaz.', {
        status: 400,
        retryable: false
      });
    }
    if (thinkingLevel && opts.thinking === 'enabled') {
      generationConfig.thinkingConfig = { thinkingLevel: 'medium' };
    } else if (opts.thinking === 'disabled') {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    } else if (opts.thinking === 'enabled') {
      const maxTokens = opts.maxOutputTokens || 8192;
      generationConfig.thinkingConfig = { thinkingBudget: Math.min(2048, maxTokens - 1) };
    }

    if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
    if (opts.topP !== undefined) generationConfig.topP = opts.topP;
    if (opts.stop) generationConfig.stopSequences = Array.isArray(opts.stop) ? opts.stop : [opts.stop];
    if (opts.responseFormat === 'json') generationConfig.responseMimeType = 'application/json';

    const body = { generationConfig, contents };
    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }

    return body;
  },

  parseResponse(payload) {
    const candidate = payload.candidates?.[0];
    const textParts = candidate?.content?.parts?.filter(p => p.text && p.thought !== true)?.map(p => p.text) || [];
    const content = textParts.join('\n');
    const finishReason = candidate?.finishReason || null;

    const inputTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = payload.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;
    const usage = { inputTokens, outputTokens, totalTokens };

    return { content, finishReason, usage, reasoning: null };
  },

  parseStreamEvent(dataStr, _event) {
    if (!dataStr || !dataStr.trim()) return null;
    try {
      const payload = JSON.parse(dataStr.trim());
      const candidate = payload.candidates?.[0];
      const textParts = candidate?.content?.parts?.filter(p => p.text && p.thought !== true)?.map(p => p.text) || [];
      const text = textParts.join('');
      const finishReason = candidate?.finishReason || null;

      let usage = null;
      if (payload.usageMetadata) {
        const inputTokens = payload.usageMetadata.promptTokenCount ?? 0;
        const outputTokens = payload.usageMetadata.candidatesTokenCount ?? 0;
        const totalTokens = payload.usageMetadata.totalTokenCount ?? inputTokens + outputTokens;
        usage = { inputTokens, outputTokens, totalTokens };
      }

      const done = finishReason !== null && finishReason !== undefined;
      return {
        text,
        finishReason,
        usage,
        done
      };
    } catch {
      return null;
    }
  },

  modelsEndpoint(_profile) {
    return 'models';
  },

  parseModels(payload) {
    const list = payload.models || [];
    const ids = list
      .filter(item => item.supportedGenerationMethods?.includes('generateContent'))
      .map(item => String(item.name || '').replace(/^models\//, ''))
      .filter(Boolean);
    return [...new Set(ids)].filter(id => id.length <= 160).slice(0, 500);
  }
};
