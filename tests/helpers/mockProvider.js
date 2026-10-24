import http from 'node:http';

export function createMockProvider() {
  let customResponse = null;
  const requests = [];

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      let body;
      try {
        body = bodyStr ? JSON.parse(bodyStr) : null;
      } catch {
        body = bodyStr;
      }

      const record = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body
      };
      requests.push(record);

      if (customResponse) {
        if (typeof customResponse === 'function') {
          return customResponse(req, res, record);
        }
        res.writeHead(customResponse.status || 200, customResponse.headers || { 'Content-Type': 'application/json' });
        return res.end(
          typeof customResponse.body === 'string' ? customResponse.body : JSON.stringify(customResponse.body)
        );
      }

      // Default mock responses
      // 1. OpenAI chat completions
      if (req.url.includes('/chat/completions')) {
        if (body?.stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          });
          res.write('data: {"choices":[{"delta":{"content":"mock "}}]}\n\n');
          res.write('data: {"choices":[{"delta":{"content":"streaming "}}]}\n\n');
          res.write('data: {"choices":[{"delta":{"content":"response"}}]}\n\n');
          res.write('data: [DONE]\n\n');
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            id: 'mock-openai-1',
            choices: [
              {
                message: { role: 'assistant', content: 'Mock OpenAI response' },
                finish_reason: 'stop'
              }
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
          })
        );
      }

      // 2. OpenAI models
      if (req.url.endsWith('/models') && !req.url.includes('generativelanguage')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'o3-mini' }]
          })
        );
      }

      // 3. Anthropic messages
      if (req.url.includes('/v1/messages')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            id: 'msg_mock_anthropic',
            content: [{ type: 'text', text: 'Mock Anthropic response' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 15, output_tokens: 10 }
          })
        );
      }

      // 4. Google Gemini generateContent
      if (req.url.includes(':generateContent')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Mock Google Gemini response' }]
                },
                finishReason: 'STOP'
              }
            ],
            usageMetadata: { promptTokenCount: 14, candidatesTokenCount: 7 }
          })
        );
      }

      // 5. Google models
      if (req.url.includes('generativelanguage') && req.url.includes('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            models: [{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-2.5-pro' }]
          })
        );
      }

      // Fallback
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });

  return {
    async start() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}`;
      return { url, port };
    },
    setResponse(resp) {
      customResponse = resp;
    },
    reset() {
      customResponse = null;
      requests.length = 0;
    },
    getRequests() {
      return requests;
    },
    async close() {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise(resolve => server.close(resolve));
    }
  };
}
