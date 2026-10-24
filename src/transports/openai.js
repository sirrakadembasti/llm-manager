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

  buildBody(profile, messages, opts = {}) {
    const modern = ['openai', 'xiaomi_mimo'].includes(profile.provider);
    const body = {
      model: profile.model,
      messages: this.normalizeMessages(messages, profile),
      [modern ? 'max_completion_tokens' : 'max_tokens']: opts.maxOutputTokens
    };

    if (profile.provider === 'xiaomi_mimo') {
      if (opts.thinking && opts.thinking !== 'auto') {
        body.thinking = { type: opts.thinking };
      }
    }

    if (opts.stream) {
      body.stream = true;
      body.stream_options = { include_usage: true };
    }

    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.topP !== undefined) body.top_p = opts.topP;
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
      const text = choice?.delta?.content || choice?.delta?.reasoning_content || '';
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
