import type {
  LLMMessage,
  LLMProfileInternal,
  RuntimeOptions,
  GenerationOptions,
  NetworkOptions,
  StreamChunk,
  TokenUsage
} from './core.js';

export interface NormalizedRuntimeOptions extends Omit<RuntimeOptions, 'stop'> {
  timeoutMs: number;
  maxOutputTokens: number;
  thinking: 'auto' | 'enabled' | 'disabled';
  stop?: string[];
}
export function normalizeRuntimeOptions(input?: RuntimeOptions): NormalizedRuntimeOptions;
export function normalizePurpose(value?: string): 'quick' | 'diagnostic' | 'default';
export function resolveRuntimeOptions(
  profile: Partial<LLMProfileInternal>,
  options?: GenerationOptions
): NormalizedRuntimeOptions;
export function providerEndpoint(
  profile: Pick<LLMProfileInternal, 'baseURL'>,
  suffix: string,
  options?: boolean | NetworkOptions
): string;
export function providerAuthHeaders(profile: Partial<LLMProfileInternal>): Record<string, string>;
export interface ClassifiedLLMError {
  error: string;
  code: string;
  status: number;
  retryable: boolean;
  upstreamStatus?: number;
}
export function classifyLLMError(error: unknown): ClassifiedLLMError;
export interface ParsedProviderResponse {
  truncated?: boolean;
  content: string;
  finishReason?: string | null;
  usage?: TokenUsage | null;
  reasoning?: string | null;
}
export interface ProviderTransport {
  id: string;
  authHeaders(profile: LLMProfileInternal): Record<string, string>;
  chatEndpoint(profile: LLMProfileInternal): string;
  streamEndpoint?(profile: LLMProfileInternal): string;
  buildBody(profile: LLMProfileInternal, messages: LLMMessage[], options?: GenerationOptions): Record<string, unknown>;
  parseResponse(payload: unknown): ParsedProviderResponse;
  parseStreamEvent(
    payload: string,
    event?: string
  ): { text?: string; done?: boolean; finishReason?: string; usage?: Partial<TokenUsage> } | null;
}
export function buildProviderRequest(
  profile: LLMProfileInternal,
  messages: LLMMessage[],
  options?: GenerationOptions
): {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  timeoutMs: number;
  transport: ProviderTransport;
};
export function generateProfileResponse(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options: GenerationOptions & { raw: true }
): Promise<ParsedProviderResponse>;
export function generateProfileResponse(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options?: GenerationOptions & { raw?: false }
): Promise<string>;
export function generateProfileResponse(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options: GenerationOptions
): Promise<string | ParsedProviderResponse>;
export function parseSseStream(
  stream: ReadableStream<Uint8Array> | null,
  transport: ProviderTransport,
  options?: { acceptTruncated?: boolean }
): AsyncIterable<StreamChunk>;
export function generateProfileStream(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options?: GenerationOptions
): AsyncIterable<StreamChunk>;
export function executeWithRetry<T>(
  operation: (context: { signal: AbortSignal; attempt: number; remainingTime: number }) => T | Promise<T>,
  options?: {
    attempts?: number;
    baseMs?: number;
    maxMs?: number;
    deadlineMs?: number;
    signal?: AbortSignal | null;
  }
): Promise<T>;
