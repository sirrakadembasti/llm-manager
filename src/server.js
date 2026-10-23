import express from 'express';
import { mountLLMManagement } from './index.js';

export async function createStandaloneServer({
  host = '127.0.0.1',
  port = 8010,
  adminUser = 'admin',
  adminPassword = process.env.LLM_ADMIN_PASSWORD,
  allowedOrigins = [],
  dataDir,
  chatTokens,
  _logger = console
} = {}) {
  if (!adminPassword) {
    throw new Error('LLM_ADMIN_PASSWORD ortam değişkenini veya adminPassword seçeneğini ayarlayın.');
  }

  const isLocalHost = ['127.0.0.1', '::1', 'localhost'].includes(host);
  if (!isLocalHost && adminPassword.length < 12) {
    throw new Error('Ağa açık sunucu için en az 12 karakterlik parola gerekir.');
  }

  const normalizedOrigins = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : String(allowedOrigins || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

  const originsSet = new Set();
  for (const origin of normalizedOrigins) {
    if (origin === '*') {
      originsSet.add('*');
    } else {
      try {
        const u = new URL(origin);
        if (u.origin === origin) {
          originsSet.add(origin);
        }
      } catch {
        // Geçersiz origin formatını atla
      }
    }
  }

  const app = express();

  if (originsSet.size > 0) {
    app.use((req, res, next) => {
      const origin = req.get('Origin');
      const isChat = req.path === '/api/llm/chat' || req.path === '/chat';

      if (originsSet.has('*')) {
        if (isChat) {
          res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LLM-CSRF'
          });
          if (req.method === 'OPTIONS') return res.sendStatus(204);
        }
      } else if (origin && originsSet.has(origin)) {
        res.set({
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LLM-CSRF',
          Vary: 'Origin'
        });
        if (req.method === 'OPTIONS') return res.sendStatus(204);
      }
      next();
    });
  }

  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => res.redirect('/llm'));

  mountLLMManagement(app, {
    adminUser,
    adminPassword,
    ...(dataDir ? { dataDir } : {}),
    ...(chatTokens ? { chatTokens } : {})
  });

  app.use((error, _req, res, _next) => {
    res.status(error.status === 413 ? 413 : 500).json({ error: 'İstek işlenemedi.' });
  });

  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(port, host, () => resolve(srv));
    srv.once('error', reject);
  });

  const actualPort = server.address().port;
  const url = `http://${host}:${actualPort}/llm`;

  const close = () =>
    new Promise(resolve => {
      server.close(() => resolve());
    });

  return { app, server, url, port: actualPort, close };
}
