import type { LLMMessage, LLMProfileInternal } from './core.js';

export function normalizeRuntimeOptions(input?: Record<string, unknown>): {
  timeoutMs: number;
  maxOutputTokens: number;
  thinking: 'auto' | 'disabled';
};

export function resolveRuntimeOptions(
  profile: LLMProfileInternal,
  options?: Record<string, unknown>
): {
  timeoutMs: number;
  maxOutputTokens: number;
  thinking: 'auto' | 'disabled';
};

export function providerEndpoint(profile: LLMProfileInternal, suffix: string, allowLocalHttp?: boolean): string;

export function providerAuthHeaders(profile: LLMProfileInternal): Record<string, string>;

export function classifyLLMError(error: unknown): {
  error: string;
  code: string;
  status: number;
};

export function buildProviderRequest(
  profile: LLMProfileInternal,
  messages: LLMMessage[],
  options?: Record<string, unknown>
): {
  url: string;
  headers: Record<string, string>;
  body: string;
};

export function generateProfileResponse(
  messages: LLMMessage[],
  profile: LLMProfileInternal,
  options?: Record<string, unknown>
): Promise<string>;
