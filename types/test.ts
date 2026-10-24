import {
  createLLMManager,
  mountLLMManagement,
  LLMError,
  ErrorCodes,
  createRateLimiter,
  redact,
  sanitizeRequestId,
  type LLMMessage,
  type LLMProfilePublic,
  type LLMStore
} from './index.js';
import { createStandaloneServer } from './server.js';
import { detectProjectType, initLLMProject } from './init.js';

// 1. Core Manager and Message types
const messages: LLMMessage[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hello!' }
];

const manager = createLLMManager({
  dataDir: './data',
  chatAccess: 'authenticated',
  chatOverrides: 'admin',
  limits: {
    maxMessages: 50,
    maxChars: 100000
  }
});

async function runTests() {
  const answer: string = await manager.ask('What is the weather?');
  console.log(answer);

  const answerFromMsgs: string = await manager.ask(messages);
  console.log(answerFromMsgs);

  for await (const chunk of manager.stream('Hello stream!')) {
    if (chunk.type === 'delta') {
      console.log('delta:', chunk.text);
    } else if (chunk.type === 'done') {
      console.log('done:', chunk.finishReason, chunk.usage);
    }
  }

  const res = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: { prompt: 'hi' },
    principal: { isAdmin: true }
  });
  if (res) {
    console.log(res.status, res.body);
  }

  // 2. Store types
  const store: LLMStore = manager.store;
  const list = await store.list();
  const profile: LLMProfilePublic | undefined = list.profiles[0];
  if (profile) {
    console.log(profile.id, profile.name, profile.hasApiKey);
  }

  // 3. Error types
  try {
    throw new LLMError(ErrorCodes.RATE_LIMITED, 'Too many requests', { status: 429 });
  } catch (err) {
    if (err instanceof LLMError) {
      console.log(err.code, err.status);
    }
  }

  // 4. Rate Limiter & Logger utilities
  const limiter = createRateLimiter({ capacity: 10, refillPerSec: 1 });
  const check = limiter.take('127.0.0.1');
  console.log(check.ok, check.remaining);

  const reqId = sanitizeRequestId('custom-request-id-12345');
  console.log(reqId);

  const masked = redact({ apiKey: 'sk-secret', normal: 'value' });
  console.log(masked);

  // 5. Server types
  const server = await createStandaloneServer({ port: 8080 });
  await server.close();

  // 6. Init types
  const projectType = detectProjectType('./');
  console.log(projectType);

  initLLMProject({ type: 'express' });
}

// 7. Express Mount
const dummyApp = {
  use: () => {},
  get: () => {}
};
mountLLMManagement(dummyApp, { adminPassword: 'test-password-123' });

void runTests;
