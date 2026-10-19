import express from 'express';
import dotenv from 'dotenv';
import { mountLLMManagement } from '../src/index.js';

dotenv.config();
if (!process.env.LLM_ADMIN_PASSWORD) {
  throw new Error('LLM_ADMIN_PASSWORD ortam değişkenini ayarlayın.');
}
const adminUser = process.env.LLM_ADMIN_USER || 'admin';
const adminPassword = process.env.LLM_ADMIN_PASSWORD;

const allowedOrigins = new Set(
  String(process.env.LLM_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

const app = express();
if (allowedOrigins.size > 0) {
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && (allowedOrigins.has('*') || allowedOrigins.has(origin))) {
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
mountLLMManagement(app, { adminUser, adminPassword });
app.use((error, _req, res, _next) => {
  res.status(error.status === 413 ? 413 : 500).json({ error: 'İstek işlenemedi.' });
});

const port = Number(process.env.PORT || 8010);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`LLM yönetimi: http://127.0.0.1:${port}/llm (Kullanıcı: ${adminUser})`);
});
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
