import crypto from 'node:crypto';

const SENSITIVE_KEY_REGEX = /^(api[_-]?key|authorization|secret|password|token|bearer)$/i;

export function redact(value, depth = 0) {
  if (depth > 10 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/^Bearer\s+[A-Za-z0-9._~+/-]+=*$/i.test(value)) return 'Bearer [REDACTED]';
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redact(v, depth + 1);
      }
    }
    return result;
  }
  return value;
}

export function sanitizeRequestId(headerValue) {
  const str = String(headerValue || '').trim();
  if (/^[A-Za-z0-9._-]{8,64}$/.test(str)) {
    return str;
  }
  return crypto.randomUUID();
}

export function createStructuredLogger(logger = null) {
  if (!logger) {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  const wrap =
    level =>
    (...args) => {
      const fn = logger[level] || logger.info || logger.log;
      if (typeof fn === 'function') {
        const redactedArgs = args.map(arg => (typeof arg === 'object' ? redact(arg) : arg));
        fn.apply(logger, redactedArgs);
      }
    };

  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error')
  };
}
