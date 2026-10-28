import { LLMErrorCode, LLMError, ErrorCodes } from './errors.js';
export type { ProjectOptions, ProjectSource, ProjectInventory, ProjectTask, ProjectCommandResult } from './project.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMTestResult {
  at: string;
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
  thinking?: 'auto' | 'enabled' | 'disabled';
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
  remove(
    id: string,
    revision?: string | null
  ): LLMStoreListResult | { ok: boolean } | Promise<LLMStoreListResult | { ok: boolean }>;
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

export type LoggerInput = Partial<StructuredLogger> & { log?: (...args: unknown[]) => void };

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
  principal?: Principal;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
  requestId?: string;
  clientKey?: string;
}

export type HandleResponse =
  | { status: number; body?: unknown; isStream?: false; requestId?: string }
  | { status: number; body?: never; isStream: true; stream: AsyncIterable<StreamChunk>; requestId?: string };

export interface LLMManagerOptions {
  project?: import('./project.js').ProjectOptions | false;
  adminPassword?: string;
  adminUser?: string;
  chatTokens?: string | string[];
  authorize?: (request: Request) => Principal | null | Promise<Principal | null>;
  insecureNoAuth?: boolean;
  dataDir?: string;
  filePath?: string;
  encryptionKey?: string;
  allowLocalHttp?: boolean;
  store?: LLMStore;
  generate?: (
    messages: LLMMessage[],
    options: GenerationOptions
  ) => string | GenerationResponse | Promise<string | GenerationResponse>;
  generateStream?: (messages: LLMMessage[], options: GenerationOptions) => AsyncIterable<StreamChunk>;
  testMessages?: (mode: 'quick' | 'conversation', profile: LLMProfileInternal) => LLMMessage[];
  validateTestReply?: (reply: string, context: { mode: string; profile: LLMProfileInternal }) => Promise<void> | void;
  limits?: LLMManagerLimits;
  chatOverrides?: 'admin' | 'all' | 'none';
  chatAccess?: 'authenticated' | 'admin' | false;
  rateLimit?: boolean | LLMManagerRateLimitConfig;
  retry?: boolean | { attempts?: number; baseMs?: number; maxMs?: number };
  logger?: LoggerInput | null;
  /** Content logging is disabled; prompts and responses are always redacted. */
  logContent?: false;
  getClientId?: (request: Request) => string | null;
  proxyUrl?: string;
  allowedHosts?: string[];
  allowedPrivateHosts?: string[];
  health?: boolean;
  usageLog?: boolean;
  homeUrl?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
}
export interface GenerationResponse {
  content: string;
  usage?: TokenUsage | null;
  finishReason?: string | null;
}
export type StreamChunk =
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      usage?: TokenUsage;
      finishReason?: string;
      profileId?: string;
      fallbackUsed?: boolean;
      truncated?: boolean;
    };

export interface RuntimeOptions {
  timeoutMs?: number;
  maxOutputTokens?: number;
  thinking?: 'auto' | 'enabled' | 'disabled';
  temperature?: number;
  topP?: number;
  stop?: string | string[];
  responseFormat?: 'text' | 'json';
}
export interface NetworkOptions {
  allowLocalHttp?: boolean;
  proxyUrl?: string;
  allowedHosts?: string[];
  allowedPrivateHosts?: string[];
}
export interface GenerationOptions extends RuntimeOptions, NetworkOptions {
  purpose?: 'quick' | 'diagnostic' | 'default' | 'manager' | 'production';
  acceptTruncated?: boolean;
  raw?: boolean;
  stream?: boolean;
  signal?: AbortSignal;
  [key: string]: unknown;
}
export interface AskOptions extends GenerationOptions {
  system?: string;
  profileId?: string;
}
export type PromptInput = string | LLMMessage[] | { prompt?: string; messages?: LLMMessage[]; system?: string };
export interface LLMManager {
  close(): Promise<void>;
  handle(options?: HandleOptions): Promise<HandleResponse | null>;
  ask(promptOrMessages: PromptInput, options: AskOptions & { raw: true }): Promise<ChatResult>;
  ask(promptOrMessages: PromptInput, options?: AskOptions & { raw?: false }): Promise<string>;
  ask(promptOrMessages: PromptInput, options: AskOptions): Promise<string | ChatResult>;
  stream(promptOrMessages: PromptInput, options?: AskOptions): AsyncIterable<StreamChunk>;
  fetch(request: Request, options?: FetchOptions): Promise<Response>;
  store: LLMStore;
}

export interface Principal {
  isAdmin?: boolean;
  id?: string;
  kind?: string;
}

export interface FetchOptions {
  apiPath?: string;
  pagePath?: string;
  requireCsrf?: boolean;
  homeUrl?: string;
  adminPassword?: string;
  adminUser?: string;
  chatTokens?: string | string[];
  authorize?: (request: Request) => Principal | null | Promise<Principal | null>;
  insecureNoAuth?: boolean;
}

export function createLLMManager(options?: LLMManagerOptions): LLMManager;
export function createLLMProfileStore(options?: {
  dataDir?: string;
  filePath?: string;
  encryptionKey?: string;
  allowLocalHttp?: boolean;
  allowedPrivateHosts?: string[];
}): AsyncLLMStore;

export type AsyncLLMStore = {
  [K in keyof LLMStore]: LLMStore[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

export function createRateLimiter(options?: { capacity?: number; refillPerSec?: number; maxKeys?: number }): {
  take(key: string, count?: number): { ok: boolean; remaining: number; retryAfterSec: number };
  check(key: string, count?: number): { ok: boolean; remaining: number; retryAfterSec: number };
  reset(key: string): void;
  size(): number;
};

export function createStructuredLogger(logger?: LoggerInput | null): StructuredLogger;
export function redact<T>(value: T, depth?: number): T;
export function sanitizeRequestId(headerValue?: unknown): string;

export interface UsageSummaryItem {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  errors: number;
}

export interface UsageSummary {
  month: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  byProfile: Record<string, UsageSummaryItem>;
}

export interface UsageTracker {
  enabled: boolean;
  record(entry?: {
    profileId?: string;
    model?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    code?: string;
  }): Promise<void>;
  getSummary(month?: string): Promise<UsageSummary>;
}

export function createUsageTracker(options?: { dataDir?: string; enabled?: boolean }): UsageTracker;
export const CSRF_HEADER: string;
export const SAFE_METHODS: readonly string[];
export function isValidMountPath(value: unknown): boolean;
export function createUiAssets(options?: { apiPath?: string; pagePath?: string; homeUrl?: string }): {
  html: string;
  script: string;
  locale: 'tr';
};

export const MESSAGES: { tr: Record<string, string> };
/** İkinci parametre eski çağrılar için korunur; mesajlar yalnız Türkçedir. */
export function getErrorMessage(code: string, legacyLocale?: string, fallback?: string | null): string;

export { LLMError, ErrorCodes, LLMErrorCode };
export interface ProviderCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly region?: string;
  readonly transport: string;
  readonly baseURL: string;
  readonly models: readonly string[];
  readonly capabilities?: Readonly<{ thinking?: boolean }>;
  readonly endpoints?: readonly Readonly<{ id?: string; name?: string; baseURL: string; models?: readonly string[] }>[];
}
export const PROVIDERS: readonly ProviderCatalogEntry[];
export const CATALOG_VERSION: string;
export const CATALOG_UPDATED_AT: string;
export const PACKAGE_VERSION: string;
export function validateProviderUrl(
  value: unknown,
  options?: Pick<NetworkOptions, 'allowLocalHttp' | 'allowedPrivateHosts'>
): string;
export { classifyLLMError, generateProfileResponse } from './runtime.js';
