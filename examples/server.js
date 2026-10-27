import { createStandaloneServer } from '../src/server.js';

// Ortam değişkenleri önceliklidir; .env yalnız eksik değerleri doldurur.
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const port = Number(process.env.PORT || 8010);
const allowedOrigins = process.env.LLM_ALLOWED_ORIGINS;
const adminUser = process.env.LLM_ADMIN_USER || 'admin';
const { url } = await createStandaloneServer({ port, adminUser, allowedOrigins, handleSignals: true });
console.log(`LLM yönetimi: ${url}`);
