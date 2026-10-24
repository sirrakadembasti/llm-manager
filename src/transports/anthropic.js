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

  streamEndpoint(_profile) {
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

    if (opts.stream) {
      body.stream = true;
    }

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

  parseStreamEvent(dataStr, event) {
    if (!dataStr) return null;
    try {
      const payload = JSON.parse(dataStr.trim());
      const type = payload.type || event;

      if (type === 'error') {
        const errMsg = payload.error?.message || 'Anthropic stream error';
        throw new LLMError(ErrorCodes.LLM_PROVIDER_ERROR, errMsg, { status: 502, retryable: false });
      }

      if (type === 'content_block_delta') {
        return {
          text: payload.delta?.text || '',
          done: false
        };
      }

      if (type === 'message_delta') {
        const finishReason = payload.delta?.stop_reason || null;
        let usage = null;
        if (payload.usage) {
          usage = {
            outputTokens: payload.usage.output_tokens ?? 0
          };
        }
        return {
          finishReason,
          usage,
          done: false
        };
      }

      if (type === 'message_start') {
        let usage = null;
        if (payload.message?.usage) {
          usage = {
            inputTokens: payload.message.usage.input_tokens ?? 0
          };
        }
        return {
          usage,
          done: false
        };
      }

      if (type === 'message_stop') {
        return { done: true };
      }

      return null;
    } catch (err) {
      if (err instanceof LLMError) throw err;
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
