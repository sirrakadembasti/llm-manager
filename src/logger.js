import crypto from 'node:crypto';

const SENSITIVE_KEY_REGEX =
  /^(api[_-]?key|authorization|proxy[_-]?authorization|secret|password|(?:access|refresh|id)[_-]?token|token|bearer|cookie|set-cookie|prompt|messages|content|response|completion)$/i;

export function redact(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (depth > 10) return '[REDACTED]';
  if (typeof value === 'string') {
    return value.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [REDACTED]');
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const result = Array.isArray(value) ? [] : {};
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        value: SENSITIVE_KEY_REGEX.test(key) ? '[REDACTED]' : redact(item, depth + 1, seen),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    seen.delete(value);
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
        fn.apply(
          logger,
          args.map(arg => redact(arg))
        );
      }
    };

  return {
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error')
  };
}
