export type LLMErrorCode =
  | 'RUNTIME_OPTIONS_INVALID'
  | 'PROFILE_INVALID'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_CONFLICT'
  | 'MESSAGES_INVALID'
  | 'PURPOSE_INVALID'
  | 'TEST_MODE_INVALID'
  | 'TEST_IN_PROGRESS'
  | 'ACTIVE_PROFILE_MISSING'
  | 'LLM_NETWORK'
  | 'LLM_DNS_BLOCKED'
  | 'LLM_RESPONSE_TOO_LARGE'
  | 'LLM_TIMEOUT'
  | 'LLM_ABORTED'
  | 'LLM_PROVIDER_ERROR'
  | 'LLM_RATE_LIMIT'
  | 'LLM_BILLING'
  | 'LLM_FORBIDDEN'
  | 'LLM_AUTH'
  | 'LLM_REQUEST_REJECTED'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_TRUNCATED'
  | 'LLM_CONTENT_FILTERED'
  | 'LLM_UPSTREAM_UNAVAILABLE'
  | 'AI_CREDENTIAL_ENDPOINT_MISMATCH'
  | 'STORE_VERSION_UNSUPPORTED'
  | 'STORE_CORRUPT'
  | 'STORE_LOCKED'
  | 'RATE_LIMITED'
  | 'BODY_INVALID'
  | 'BODY_TOO_LARGE'
  | 'AUTH_NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CHAT_DISABLED'
  | 'HEALTH_DISABLED'
  | 'API_KEY_REQUIRED'
  | 'PARAMS_INVALID';

export class LLMError extends Error {
  code: LLMErrorCode | string;
  status?: number;
  retryable?: boolean;
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

export const ErrorCodes: Readonly<{ [Code in LLMErrorCode]: Code }>;

export function isLLMError(error: unknown, code?: LLMErrorCode | string): error is LLMError;
