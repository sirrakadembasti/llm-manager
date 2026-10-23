export class LLMError extends Error {
  constructor(code, message, { status, retryable, upstreamStatus, cause } = {}) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'LLMError';
    this.code = code;
    if (status !== undefined) this.status = status;
    if (retryable !== undefined) this.retryable = retryable;
    if (upstreamStatus !== undefined) this.upstreamStatus = upstreamStatus;
  }
}

export const ErrorCodes = Object.freeze({
  // Runtime options & validation
  RUNTIME_OPTIONS_INVALID: 'RUNTIME_OPTIONS_INVALID',
  PROFILE_INVALID: 'PROFILE_INVALID',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_CONFLICT: 'PROFILE_CONFLICT',
  MESSAGES_INVALID: 'MESSAGES_INVALID',
  PURPOSE_INVALID: 'PURPOSE_INVALID',
  TEST_MODE_INVALID: 'TEST_MODE_INVALID',
  TEST_IN_PROGRESS: 'TEST_IN_PROGRESS',
  ACTIVE_PROFILE_MISSING: 'ACTIVE_PROFILE_MISSING',

  // Network / Transport / DNS
  LLM_NETWORK: 'LLM_NETWORK',
  LLM_DNS_BLOCKED: 'LLM_DNS_BLOCKED',
  LLM_RESPONSE_TOO_LARGE: 'LLM_RESPONSE_TOO_LARGE',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_ABORTED: 'LLM_ABORTED',

  // Provider response
  LLM_PROVIDER_ERROR: 'LLM_PROVIDER_ERROR',
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT',
  LLM_BILLING: 'LLM_BILLING',
  LLM_FORBIDDEN: 'LLM_FORBIDDEN',
  LLM_AUTH: 'LLM_AUTH',
  LLM_REQUEST_REJECTED: 'LLM_REQUEST_REJECTED',
  LLM_EMPTY_RESPONSE: 'LLM_EMPTY_RESPONSE',
  LLM_TRUNCATED: 'LLM_TRUNCATED',
  LLM_CONTENT_FILTERED: 'LLM_CONTENT_FILTERED',
  LLM_UPSTREAM_UNAVAILABLE: 'LLM_UPSTREAM_UNAVAILABLE',
  AI_CREDENTIAL_ENDPOINT_MISMATCH: 'AI_CREDENTIAL_ENDPOINT_MISMATCH',

  // Store & operational codes (B2, B3, C1, C3)
  STORE_VERSION_UNSUPPORTED: 'STORE_VERSION_UNSUPPORTED',
  STORE_CORRUPT: 'STORE_CORRUPT',
  STORE_LOCKED: 'STORE_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  BODY_INVALID: 'BODY_INVALID'
});

export function isLLMError(error, code) {
  if (!(error instanceof LLMError) && error?.name !== 'LLMError') return false;
  return code ? error.code === code : true;
}
