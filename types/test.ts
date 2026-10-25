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
} from '@sirrakadembasti/llm-manager';
import { createStandaloneServer } from '@sirrakadembasti/llm-manager/server';
import { detectProjectType, initLLMProject } from '@sirrakadembasti/llm-manager/init';

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

// Public contracts: these calls must compile without any casts.
import {
  generateProfileResponse,
  normalizeRuntimeOptions,
  buildProviderRequest,
  executeWithRetry,
  generateProfileStream
} from '@sirrakadembasti/llm-manager/runtime';
import { injectIntoEntryFile, probeAndOpenBrowser, verifyIntegration } from '@sirrakadembasti/llm-manager/init';
import {
  ensureLLMEncryptionKey,
  rotateEncryptionKey,
  exportProfiles,
  importProfiles
} from '@sirrakadembasti/llm-manager/setup';
import { isLLMError } from '@sirrakadembasti/llm-manager/errors';
import type { ChatResult, LLMProfileInternal } from '@sirrakadembasti/llm-manager/core';
declare const internalProfile: LLMProfileInternal;
async function publicContract() {
  const text: string = await manager.ask('hello');
  const raw: ChatResult = await manager.ask('hello', { raw: true, signal: new AbortController().signal });
  // @ts-expect-error default ask returns text, not an untyped object
  const invalid: number = await manager.ask('hello');
  const mounted = mountLLMManagement(dummyApp, { adminPassword: 'test', testMessages: () => messages });
  const mountedText: string = await mounted.ask('hello');
  const injected = injectIntoEntryFile({ esm: true, entryFile: null });
  injected.rollback();
  const diff: string = injected.diffPreview;
  const init = initLLMProject({ password: 'test', force: true });
  const files: string[] = init.createdFiles;
  const verified = verifyIntegration({ entryFile: null });
  const passed: boolean = verified.checks[0].ok;
  const probe = await probeAndOpenBrowser({ password: 'test', openBrowser: false });
  const started: boolean = probe.startedServer;
  const normalized = normalizeRuntimeOptions({ thinking: 'enabled', stop: 'END', temperature: 0.5 });
  const stop: string[] | undefined = normalized.stop;
  const request = buildProviderRequest(internalProfile, messages);
  const body: Record<string, unknown> = request.body;
  const generated = await generateProfileResponse(messages, internalProfile, { raw: true });
  const content: string = generated.content;
  const retried: string = await executeWithRetry(async ({ signal }) => String(signal.aborted));
  for await (const chunk of generateProfileStream(messages, internalProfile)) console.log(chunk.type);
  const key: string = ensureLLMEncryptionKey({ writeEnv: false, environment: {} });
  const rotation = rotateEncryptionKey({ oldKey: key });
  const backup: string | null = rotation.backupKeyPath;
  const exported: number = exportProfiles({ password: 'pass', outputPath: 'backup.json' }).profileCount;
  const imported: number = importProfiles({ password: 'pass', inputPath: 'backup.json' }).importedCount;
  const server = await createStandaloneServer({ allowedOrigins: 'https://example.com', logger: { info() {} } });
  const port: number = server.port;
  const response = await manager.handle({ signal: new AbortController().signal, query: { month: '2026-10' } });
  if (response?.isStream) for await (const chunk of response.stream) console.log(chunk.type);
  if (isLLMError(raw, ErrorCodes.LLM_RATE_LIMIT)) console.log(raw.code);
  void [
    text,
    raw,
    invalid,
    mountedText,
    diff,
    files,
    passed,
    started,
    stop,
    body,
    content,
    retried,
    backup,
    exported,
    imported,
    port
  ];
}
void publicContract;

// Public Basic-auth config and normalized diagnostic data contracts.
import { createBasicAuth } from '@sirrakadembasti/llm-manager';
createBasicAuth({
  password: 'test',
  rateLimit: { authFailuresPerMinute: 2 },
  logger: { debug() {}, info() {}, warn() {}, error() {} }
});
