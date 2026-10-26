import { createStandaloneServer } from '../src/server.js';

const port = Number(process.env.PORT || 8010);
const allowedOrigins = process.env.LLM_ALLOWED_ORIGINS;
const { url } = await createStandaloneServer({ port, allowedOrigins, handleSignals: true });
console.log(`LLM yönetimi: ${url}`);
