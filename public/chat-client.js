function createLLMChatClient({ baseURL, fetchImpl = (...args) => fetch(...args) }) {
  async function transmit({ profileId, messages, stream = false, signal, onDelta = () => {} }) {
    const started = Date.now();
    const deadline = AbortSignal.timeout(330000);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const response = await fetchImpl(`${baseURL.replace(/\/$/, '')}/chat`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: combined,
      headers: { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
      body: JSON.stringify({ profileId, messages, stream })
    });
    const failure = data =>
      Object.assign(new Error(data?.error || `HTTP ${response.status}`), {
        code: data?.code,
        supportId: data?.requestId || response.headers?.get('x-request-id')
      });
    if (!response.ok) throw failure(await response.json().catch(() => null));
    if (!stream) return { ...(await response.json()), durationMs: Date.now() - started };
    if (!response.headers?.get('content-type')?.includes('text/event-stream') || !response.body)
      throw new Error('Sunucu geçerli bir yanıt akışı döndürmedi.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '',
      content = '',
      usage = null,
      finishReason,
      completed = false,
      bytes = 0,
      event = '';
    const line = value => {
      if (!value) {
        event = '';
        return;
      }
      if (value.startsWith('event:')) {
        event = value.slice(6).trim();
        return;
      }
      if (!value.startsWith('data:')) return;
      let data;
      try {
        data = JSON.parse(value.slice(5).trim());
      } catch {
        throw new Error('Sunucu geçersiz akış verisi döndürdü.');
      }
      if (data.error) throw failure(data);
      if (completed) throw new Error('Yanıt tamamlandıktan sonra beklenmeyen veri alındı.');
      if (typeof data.text === 'string') {
        content += data.text;
        onDelta(data.text);
      }
      if (data.usage) usage = data.usage;
      if (event === 'done' || data.finishReason !== undefined) {
        finishReason = data.finishReason || 'stop';
        completed = true;
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) throw new Error('Yanıt akışı boyut sınırını aştı.');
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const value of lines) line(value.replace(/\r$/, ''));
      }
      if (buffer.trim()) line(buffer.replace(/\r$/, ''));
      if (!completed) throw new Error('Yanıt akışı tamamlanmadan kesildi.');
      return { content, usage, finishReason, durationMs: Date.now() - started };
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  async function send(input) {
    try {
      return await transmit(input);
    } catch (error) {
      if (error.name === 'SyntaxError') throw new Error('Sunucu geçersiz JSON yanıtı döndürdü.', { cause: error });
      if (error.name === 'TimeoutError')
        throw Object.assign(new Error('Model yanıtı zaman sınırını aştı.', { cause: error }), { code: 'LLM_TIMEOUT' });
      if (error.name === 'TypeError')
        throw Object.assign(new Error('Model sunucusuna ulaşılamadı. Bağlantıyı kontrol edin.', { cause: error }), {
          code: 'LLM_NETWORK'
        });
      throw error;
    }
  }
  return { send };
}

if (typeof window !== 'undefined') window.createLLMChatClient = createLLMChatClient;
