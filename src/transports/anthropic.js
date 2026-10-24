import { LLMError, ErrorCodes } from '../errors.js';

export default {
  id: 'anthropic',

  authHeaders(profile) {
    return {
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01'
    };
  },

  chatEndpoint(_profile) {
    return 'messages';
  },

  normalizeMessages(messages, _profile) {
    if (!Array.isArray(messages) || !messages.length) return messages;

    const nonSystem = messages.filter(m => m.role !== 'system');
    if (nonSystem.length && nonSystem[0].role === 'assistant') {
      throw new LLMError(ErrorCodes.MESSAGES_INVALID, "Anthropic için ilk mesaj 'user' olmalıdır.", {
        status: 400,
        retryable: false
      });
    }

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

    const normalizedNonSystem = this.normalizeMessages(messages, profile);
    const body = {
      model: profile.model,
      max_tokens: opts.maxOutputTokens,
      messages: normalizedNonSystem
    };

    if (systemText) {
      body.system = systemText;
    }

    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.topP !== undefined) body.top_p = opts.topP;
    if (opts.stop) body.stop_sequences = Array.isArray(opts.stop) ? opts.stop : [opts.stop];

    return body;
  },

  parseResponse(payload) {
    const textParts = payload.content?.filter(p => p.type === 'text').map(p => p.text) || [];
    const content = textParts.join('\n');
    const finishReason = payload.stop_reason || null;

    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;
    const usage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };

    return { content, finishReason, usage, reasoning: null };
  },

  parseStreamEvent(_line) {
    return null;
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
