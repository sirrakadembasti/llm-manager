import express from 'express';
import { mountLLMManagement } from './index.js';

// Ters vekil güveni: kapalı (varsayılan), atlama sayısı (1), true ya da Express'in kabul ettiği adres listesi/adı
// ('127.0.0.1,loopback'). Ortam değişkeni ve CLI metin verdiği için metin biçimleri de ayrıştırılır.
function trustProxySetting(value) {
  if (value === undefined || value === null || value === false) return false;
  let setting = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text || text.toLowerCase() === 'false') return false;
    setting = text.toLowerCase() === 'true' ? true : /^\d+$/.test(text) ? Number(text) : text;
  }
  if (setting === 0) return false;
  const valid = setting === true || typeof setting === 'string' || (Number.isInteger(setting) && setting > 0);
  if (!valid) throw new Error('Geçersiz trustProxy değeri: atlama sayısı, true veya adres listesi verin.');
  return setting;
}

export async function createStandaloneServer({
  host = '127.0.0.1',
  port = 8010,
  adminUser = 'admin',
  adminPassword = process.env.LLM_ADMIN_PASSWORD,
  allowedOrigins = [],
  trustProxy,
  dataDir,
  chatTokens,
  logger = console,
  handleSignals = false,
  pagePath = '/llm',
  apiPath = '/api/llm',
  ...managerOptions
} = {}) {
  if (!adminPassword) {
    throw new Error('LLM_ADMIN_PASSWORD ortam değişkenini veya adminPassword seçeneğini ayarlayın.');
  }

  const isLocalHost = ['127.0.0.1', '::1'].includes(host);
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

  const trust = trustProxySetting(trustProxy);
  const app = express();
  if (trust !== false) {
    try {
      app.set('trust proxy', trust);
    } catch {
      throw new Error(
        'Geçersiz trustProxy değeri: adres listesi veya adları (loopback, linklocal, uniquelocal) bekleniyor.'
      );
    }
  }

  if (originsSet.size > 0) {
    app.use((req, res, next) => {
      const origin = req.get('Origin');
      const chatPath = `${apiPath}/chat`;
      const isChat = req.path === chatPath || req.path === `${chatPath}/`;

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

  app.get('/', (_req, res) => res.redirect(pagePath));

  const management = mountLLMManagement(app, {
    ...managerOptions,
    pagePath,
    apiPath,
    logger,
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
  const url = `http://${host.includes(':') ? `[${host}]` : host}:${actualPort}${pagePath}`;

  let closed = false;
  let closePromise;
  let shutdownTimer;
  let shuttingDown = false;
  const close = () => {
    if (!closePromise) {
      const drained = new Promise(resolve => {
        if (closed) return resolve();
        server.once('close', resolve);
        // Stop listening synchronously, then cancel project work while HTTP drains.
        if (server.listening) server.close();
      });
      closePromise = Promise.all([management.close(), drained]).then(() => undefined);
    }
    return closePromise;
  };
  const shutdown = () => {
    if (shuttingDown || closed) return;
    shuttingDown = true;
    shutdownTimer = setTimeout(() => process.exit(1), 10000);
    close().then(() => process.exit(0));
  };
  server.once('close', () => {
    void management.close();
    closed = true;
    clearTimeout(shutdownTimer);
    if (handleSignals === true) {
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
    }
  });
  if (handleSignals === true) {
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  return { app, server, url, port: actualPort, close };
}
