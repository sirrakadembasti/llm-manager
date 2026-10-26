# Threat Model: LLM Manager

This document identifies the protected assets, threat vectors, attack surfaces, and current mitigation controls in `llm-manager`. Future controls are explicitly labeled as planned and are not enforced today.

---

## 1. Protected Assets

| Asset | Description | Sensitivity | Primary Storage / Exposure Risk |
| --- | --- | --- | --- |
| **Provider API Keys** | Upstream API keys (OpenAI, Anthropic, Google, etc.) | Critical | Stored in `llm-profiles.json` encrypted with AES-256-GCM. Never transmitted to browsers or logged. |
| **Encryption Master Key** | AES-256-GCM key (256-bit) | Critical | Stored in `llm-encryption.key` or `LLM_CONFIG_ENCRYPTION_KEY`. Must be protected with OS file permissions (`chmod 600`). |
| **Admin Password** | HTTP Basic Auth password (`adminPassword`) | High | Checked using constant-time SHA-256 comparison (`timingSafeEqual`). Never logged. |
| **Prompts & Completions** | User prompts and AI generated responses | High | Memory only during processing; never persisted to disk by default. Logs record only token usage and latency. |
| **Usage Metadata** | Monthly request counts and token metrics | Low/Medium | Appended to `data/usage-YYYY-MM.jsonl` without prompts, completions, or secrets. |

---

## 2. Threat Analysis & Mitigations

### 2.1 Server-Side Request Forgery (SSRF) & DNS Rebinding
- **Threat**: An attacker with admin privileges (or via manipulated profile URLs) sets `baseURL` to an internal service (`http://169.254.169.254/latest/meta-data/` or `http://192.168.1.1/`) to read internal infrastructure data.
- **Mitigation**:
  - `providerFetch` enforces `https:` by default.
  - Custom DNS lookup (`createPublicLookup`) resolves IPs at the socket level and rejects private ranges:
    - IPv4: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`.
    - IPv6: `::1`, `fc00::/7`, `fe80::/10`.
  - When corporate proxy (`proxyUrl`) is configured, socket-level DNS inspection is bypassed by the proxy; therefore, destination hostnames are strictly validated against **known official catalog domains** and explicitly configured `allowedHosts` (`LLM_DNS_BLOCKED`).
  - Local/LAN model instances require explicit whitelist configuration via `allowedPrivateHosts`.

### 2.2 Cross-Site Request Forgery (CSRF)
- **Threat**: A malicious website triggers authenticated state-changing actions (creating/deleting profiles, triggering expensive generation requests) using the user's browser credentials.
- **Mitigation**:
  - All mutating endpoints (`POST`, `PUT`, `DELETE`) require the custom header `X-LLM-CSRF: 1`.
  - Browsers will not send custom headers cross-origin without explicit CORS preflight (`OPTIONS`) approval.
  - Strict security headers (`SameSite`, `X-Frame-Options: DENY`, `Content-Security-Policy`) prevent clickjacking and framing.

### 2.3 Credential & Secret Leakage
- **Threat**: API keys, master keys, or passwords appear in public API listings, console logs, or version control.
- **Mitigation**:
  - `GET /profiles` returns `hasApiKey: true/false` and explicitly omits the `apiKey` property.
  - `src/logger.js` passes all logged objects through `redact()`, masking `apiKey`, `authorization`, `password`, `secret`, and `bearer` tokens.
  - The live model preview endpoint (`POST /models/preview`) fetches models upstream using saved or provided credentials without ever echoing the key back in the HTTP response.
  - The health endpoint (`GET /health`) is unauthenticated but strictly returns `{ ok: true, version, hasActiveProfile }` without disclosing profile IDs, names, or credentials.
  - `package.json` bundle rules and automated tests verify `npm pack --dry-run` completely excludes `tests/`, `data/`, and `.env` files.

### 2.4 Brute-Force & Unauthorized Access
- **Threat**: Automated password guessing on HTTP Basic Auth or unauthorized access to `/chat`.
- **Mitigation**:
  - Constant-time comparison prevents timing side-channel attacks against passwords.
  - In-memory token bucket rate limiter (`src/rateLimit.js`) blocks repeated Basic Auth failures (>10 failures/minute/IP) with HTTP 429 and `Retry-After`.
  - Configurable `chatAccess` controls: `'authenticated'`, `'admin'`, or `false` (disabled).

### 2.5 Resource Exhaustion & Cost Abuse
- **Threat**: An attacker submits massive payloads, requests excessive tokens, or opens persistent hanging connections to exhaust memory or balloon API bills.
- **Mitigation**:
  - Inbound body size is capped (default: 256 KB, HTTP 413 `BODY_TOO_LARGE`).
  - Request constraints: max 100 messages, max 200,000 total characters, max 100,000 single message characters.
  - Outbound payload limits: responses buffered by `providerFetch` are capped at 2 MiB; SSE stream buffers are capped at 8 MiB.
  - Strict rate limits per minute on `/chat`, `/test`, and `/models`.
  - Client disconnection aborts upstream HTTP requests immediately via `AbortController`.
  - Role-based override protection (`chatOverrides: 'admin'`): non-admin callers cannot override `profileId`, `timeoutMs`, `maxOutputTokens`, or `thinking`.

### 2.6 Data Integrity & Multi-Process File Locking
- **Threat**: Multiple Node worker processes writing concurrently to `llm-profiles.json` cause data corruption or lost updates.
- **Mitigation**:
  - Atomic advisory file lock (`src/store/fileLock.js`) with stale lock expiration (>10s) and PID check.
  - Automatic single-generation backup (`llm-profiles.json.bak`) generated prior to every write.
  - Windows `EBUSY`/`EPERM` retry loop with exponential backoff on atomic rename operations.

---

### 2.7 Supply Chain

- **Threat**: A compromised dependency update, manipulated lockfile, CI action, or publisher account can introduce malicious code or publish a package from an untrusted origin, exposing API keys, admin credentials, and prompt content.
- **Current controls**:
  - `package.json` declares `undici` as the runtime dependency and optional peer `express`; development tools and test hosts are separate development dependencies. A small runtime dependency set reduces exposure but does not eliminate transitive or build-tool risk.
  - CI uses `npm ci` with the committed `package-lock.json` for repeatable dependency resolution. Lockfile integrity checks detect changed downloaded bytes against recorded hashes, not malicious code already accepted into the lockfile.
  - CI runs `npm audit --omit=dev`; this checks known production dependency advisories and does not cover development dependencies or prove that a package is trustworthy.
  - The package `files` allowlist and CI `npm pack --dry-run` check exclude test/data directories and `.env` secrets from the publish bundle. These checks do not authenticate the publisher or the source of a release.
  - The repository has no publishing workflow; `publishConfig.access` is `public` and local release scripts run tests and increment versions. CI uses `actions/checkout@v4` and `actions/setup-node@v4` tags, not immutable commit pins. No release provenance or signing enforcement is configured here.
- **Planned controls (not implemented)**:
  - Establish dependency and lockfile update review, including development tooling and install scripts, and evaluate automated update/advisory monitoring beyond the production-only audit.
  - Pin third-party CI actions to reviewed immutable commit SHAs and define a process for reviewing pin updates.
  - Define a publishing-origin policy before adding automation: verify reviewed source/tag identity, restrict publisher credentials, and evaluate npm provenance and artifact signing. These are future protections, not guarantees for current packages.

---

## 3. Operator Security Best Practices

1. **Protect Encryption Keys**: Ensure permissions on the directory containing `llm-encryption.key` and `llm-profiles.json` are restricted (e.g. `chmod 700 /data && chmod 600 /data/*`).
2. **Reverse Proxy & TLS**: Always deploy behind a reverse proxy (Nginx, Caddy, Cloudflare, Traefik) terminating TLS.
3. **Strong Admin Credentials**: When exposing standalone management servers on public networks (`--host 0.0.0.0`), ensure passwords are at least 12 characters long and generated with sufficient entropy.
