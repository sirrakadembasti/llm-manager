import { LLMErrorCode, LLMError, ErrorCodes } from './errors.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMTestResult {
  at: number;
  status: 'passed' | 'failed';
  mode: 'quick' | 'conversation';
  durationMs: number;
  code?: string;
}

export interface LLMProfilePublic {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseURL: string;
  hasApiKey: boolean;
  revision: string | null;
  timeoutMs?: number;
  maxOutputTokens?: number;
  thinking?: 'auto' | 'disabled';
  temperature?: number;
  topP?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
  fallbackProfileIds?: string[];
  lastTest?: LLMTestResult | null;
  lastTests?: Record<string, LLMTestResult>;
}

export interface LLMProfileInternal extends LLMProfilePublic {
  apiKey: string;
  transport?: 'openai' | 'anthropic' | 'google';
  secret?: string;
}

export interface LLMStoreListResult {
  version: number;
  activeId: string | null;
  profiles: LLMProfilePublic[];
}

export interface LLMStore {
  list(): LLMStoreListResult | Promise<LLMStoreListResult>;
  getActive(): LLMProfileInternal | null | Promise<LLMProfileInternal | null>;
  get(id: string): LLMProfileInternal | null | Promise<LLMProfileInternal | null>;
  save(
    profile: Partial<LLMProfileInternal> & { name: string; provider: string; model: string }
  ): LLMProfilePublic | Promise<LLMProfilePublic>;
  remove(id: string, revision?: string | null): { ok: boolean } | Promise<{ ok: boolean }>;
  activate(id: string, revision?: string | null): LLMStoreListResult | Promise<LLMStoreListResult>;
  recordTest(
    id: string,
    status: 'passed' | 'failed',
    revision?: string | null,
    details?: Record<string, unknown>
  ): LLMProfilePublic | null | Promise<LLMProfilePublic | null>;
}

export interface LLMManagerLimits {
  maxMessages?: number;
  maxChars?: number;
  maxSingleMessageChars?: number;
  maxBodyBytes?: number;
}

export interface LLMManagerRateLimitConfig {
  chatPerMinute?: number;
  testPerMinute?: number;
  authFailuresPerMinute?: number;
}

export interface StructuredLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface ChatResult {
  ok: boolean;
  content: string;
  text?: string;
  profileId: string;
  profileName?: string;
  provider: string;
  model: string;
  durationMs: number;
  requestId?: string;
  finishReason?: string | null;
  fallbackUsed?: boolean;
  primaryProfileId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  } | null;
}

export interface HandleOptions {
  method?: string;
  path?: string;
  body?: unknown;
  principal?: { isAdmin?: boolean; id?: string };
  requestId?: string;
  clientKey?: string;
}

export interface HandleResponse {
  status: number;
  body?: unknown;
}

export interface LLMManagerOptions {
  dataDir?: string;
  filePath?: string;
  encryptionKey?: string;
  allowLocalHttp?: boolean;
  store?: LLMStore;
  generate?: (messages: LLMMessage[], options: Record<string, unknown>) => Promise<string>;
  testMessages?: LLMMessage[];
  validateTestReply?: (reply: string, context: { mode: string; profile: LLMProfileInternal }) => Promise<void> | void;
  limits?: LLMManagerLimits;
  chatOverrides?: 'admin' | 'all' | 'none';
  chatAccess?: 'authenticated' | 'admin' | false;
  rateLimit?: boolean | LLMManagerRateLimitConfig;
  retry?: boolean | { attempts?: number; baseMs?: number; maxMs?: number };
  logger?: StructuredLogger | null;
  getClientId?: (request: Request) => string | null;
  proxyUrl?: string;
  allowedHosts?: string[];
  allowedPrivateHosts?: string[];
  apiPath?: string;
  pagePath?: string;
  requireCsrf?: boolean;
}

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number; totalTokens: number }; finishReason?: string };

export interface LLMManager {
  handle(options: HandleOptions): Promise<HandleResponse | null>;
  ask(promptOrMessages: string | LLMMessage[], options?: Record<string, unknown> & { raw?: boolean }): Promise<any>;
  stream(promptOrMessages: string | LLMMessage[], options?: Record<string, unknown>): AsyncIterable<StreamChunk>;
  fetch(request: Request): Promise<Response>;
  store: LLMStore;
}

export function createLLMManager(options?: LLMManagerOptions): LLMManager;
export function createLLMProfileStore(options?: {
  dataDir?: string;
  filePath?: string;
  encryptionKey?: string;
  allowLocalHttp?: boolean;
}): LLMStore;

export function createRateLimiter(options?: { capacity?: number; refillPerSec?: number; maxKeys?: number }): {
  take(key: string, count?: number): { ok: boolean; remaining: number; retryAfterSec: number };
  check(key: string, count?: number): { ok: boolean; remaining: number; retryAfterSec: number };
  reset(key: string): void;
  size(): number;
};

export function createStructuredLogger(logger?: unknown): StructuredLogger;
export function redact<T>(value: T, depth?: number): T;
export function sanitizeRequestId(headerValue?: unknown): string;

export const CSRF_HEADER: string;
export const SAFE_METHODS: readonly string[];
export function isValidMountPath(value: unknown): boolean;
export function createUiAssets(options: { apiPath: string; pagePath: string }): { html: string; script: string };

export { LLMError, ErrorCodes, LLMErrorCode };
export const PROVIDERS: readonly unknown[];
export const CATALOG_VERSION: string;
export const CATALOG_UPDATED_AT: string;
export function validateProviderUrl(value: unknown, options?: { allowLocalHttp?: boolean }): string;
export function classifyLLMError(error: unknown): { error: string; code: string; status: number };
export function generateProfileResponse(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options?: Record<string, unknown>
): Promise<string>;
