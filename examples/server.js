import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import { createLLMProfileStore, mountLLMManagement } from '../src/index.js';
import { ensureLLMEncryptionKey } from '../src/setup.js';

dotenv.config();
if (!process.env.LLM_ADMIN_USER || !process.env.LLM_ADMIN_PASSWORD) {
  throw new Error('LLM_ADMIN_USER ve LLM_ADMIN_PASSWORD ortam değişkenlerini ayarlayın.');
}
const filePath = process.env.LLM_CONFIG_PATH || path.resolve('data/llm-profiles.json');
const encryptionKey = ensureLLMEncryptionKey({
  profilePath: filePath,
  environment: { ...process.env, NODE_ENV: 'production' }
});

const equal = (left, right) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const requireAuth = (req, res, next) => {
  const authorization = req.get('Authorization') || '';
  const decoded = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString()
    : '';
  const colon = decoded.indexOf(':');
  if (
    colon < 0
    || !equal(decoded.slice(0, colon), process.env.LLM_ADMIN_USER)
    || !equal(decoded.slice(colon + 1), process.env.LLM_ADMIN_PASSWORD)
  ) {
    res.set('WWW-Authenticate', 'Basic realm="LLM Yonetimi"');
    return res.sendStatus(401);
  }
  req.user = { isAdmin: true };
  next();
};

const app = express();
app.use(express.json({ limit: '32kb' }));
app.get('/', (_req, res) => res.redirect('/llm'));
mountLLMManagement(app, { requireAuth, store: createLLMProfileStore({ filePath, encryptionKey }) });
app.use((error, _req, res, _next) => {
  res.status(error.status === 413 ? 413 : 500).json({ error: 'İstek işlenemedi.' });
});

const port = Number(process.env.PORT || 8010);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`LLM yönetimi: http://127.0.0.1:${port}/llm`);
});
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
