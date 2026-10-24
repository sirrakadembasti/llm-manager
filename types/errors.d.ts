export type LLMErrorCode =
  | 'RUNTIME_OPTIONS_INVALID'
  | 'PROFILE_INVALID'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_CONFLICT'
  | 'STORE_LOCKED'
  | 'STORE_CORRUPT'
  | 'STORE_VERSION_UNSUPPORTED'
  | 'MESSAGES_INVALID'
  | 'BODY_TOO_LARGE'
  | 'BODY_INVALID'
  | 'PURPOSE_INVALID'
  | 'ACTIVE_PROFILE_MISSING'
  | 'CHAT_DISABLED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'CSRF_REQUIRED'
  | 'LLM_ERROR'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_CONTENT_FILTERED'
  | 'LLM_UPSTREAM_UNAVAILABLE'
  | 'LLM_NETWORK'
  | 'LLM_DNS_BLOCKED'
  | 'LLM_RESPONSE_TOO_LARGE'
  | 'LLM_TIMEOUT'
  | 'LLM_ABORTED';

export class LLMError extends Error {
  code: LLMErrorCode | string;
  status: number;
  retryable: boolean;
  upstreamStatus?: number;
  cause?: unknown;

  constructor(
    code: LLMErrorCode | string,
    message: string,
    options?: {
      status?: number;
      retryable?: boolean;
      upstreamStatus?: number;
      cause?: unknown;
    }
  );
}

export const ErrorCodes: Readonly<Record<LLMErrorCode, LLMErrorCode>>;

export function isLLMError(error: unknown): error is LLMError;
