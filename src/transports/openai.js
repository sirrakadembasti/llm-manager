import { PROVIDERS, modelFamily } from '../providers.js';

export default {
  id: 'openai',

  authHeaders(profile) {
    return { Authorization: `Bearer ${profile.apiKey}` };
  },

  chatEndpoint(_profile) {
    return 'chat/completions';
  },

  streamEndpoint(_profile) {
    return 'chat/completions';
  },

  normalizeMessages(messages, profile) {
    if (!Array.isArray(messages) || !messages.length) return messages;

    // Perplexity requires strict alternation between user and assistant
    if (profile?.provider === 'perplexity') {
      const systemMessages = messages.filter(m => m.role === 'system');
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
      return [...systemMessages, ...merged];
    }

    return messages;
  },

  // Alan adları ve düşünme biçimi sağlayıcı kataloğundan (`providers.json`), model ailesi kuralları `modelFamilies`
  // bölümünden gelir; katalogda olmayan sağlayıcı veya model için ek alan gönderilmez.
  buildBody(profile, messages, opts = {}) {
    const settings = PROVIDERS.find(p => p.id === profile.provider) ?? {};
    const family = modelFamily('openai', profile.model);
    const body = {
      model: profile.model,
      messages: this.normalizeMessages(messages, profile),
      [settings.tokenField ?? 'max_tokens']: opts.maxOutputTokens
    };

    if (settings.thinkingStyle === 'thinking_object') {
      if (opts.thinking && opts.thinking !== 'auto') {
        body.thinking = { type: opts.thinking };
      }
    } else if (settings.thinkingStyle === 'enable_thinking') {
      if (opts.thinking === 'enabled') {
        body.enable_thinking = true;
      } else if (opts.thinking === 'disabled') {
        body.enable_thinking = false;
      }
    } else if (settings.thinkingStyle === 'reasoning_effort') {
      if (opts.thinking === 'enabled') {
        body.reasoning_effort = 'medium';
      } else if (opts.thinking === 'disabled' && family?.disableThinking) {
        body.reasoning_effort = family.disableThinking;
      }
    }

    if (opts.stream) {
      body.stream = true;
      if (settings.streamUsage) body.stream_options = { include_usage: true };
    }

    const samplingSupported = family?.samplingWithThinking !== false || body.reasoning_effort === 'none';
    if (opts.temperature !== undefined && samplingSupported) body.temperature = opts.temperature;
    if (opts.topP !== undefined && samplingSupported) body.top_p = opts.topP;
    if (opts.stop) body.stop = opts.stop;
    if (opts.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    return body;
  },

  parseResponse(payload) {
    const choice = payload.choices?.[0];
    const content = choice?.message?.content || '';
    const finishReason = choice?.finish_reason || null;
    const reasoning = choice?.message?.reasoning_content || null;

    const usage = {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
      totalTokens:
        payload.usage?.total_tokens ?? (payload.usage?.prompt_tokens ?? 0) + (payload.usage?.completion_tokens ?? 0)
    };

    return { content, finishReason, usage, reasoning };
  },

  parseStreamEvent(dataStr, _event) {
    if (!dataStr) return null;
    const trimmed = dataStr.trim();
    if (trimmed === '[DONE]') {
      return { done: true };
    }
    try {
      const payload = JSON.parse(trimmed);
      const choice = payload.choices?.[0];
      const text = choice?.delta?.content || '';
      const finishReason = choice?.finish_reason || null;
      let usage = null;
      if (payload.usage) {
        const inputTokens = payload.usage.prompt_tokens ?? 0;
        const outputTokens = payload.usage.completion_tokens ?? 0;
        const totalTokens = payload.usage.total_tokens ?? inputTokens + outputTokens;
        usage = { inputTokens, outputTokens, totalTokens };
      }
      return {
        text,
        finishReason,
        usage,
        done: false
      };
    } catch {
      return null;
    }
  },

  modelsEndpoint(_profile) {
    return 'models';
  },

  parseModels(payload) {
    const list = payload.data || payload.models || [];
    const ids = list.map(item => item.id || item.name).filter(Boolean);
    return [...new Set(ids)].filter(id => id.length <= 160).slice(0, 500);
  }
};
