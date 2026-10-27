# Threat Model

Current repository controls are listed below. Planned controls are not guarantees.

## 1. Protected Assets

| Asset | Protection / risk |
| --- | --- |
| Provider keys | AES-256-GCM in profile file; never exposed in public DTOs/logs |
| Master key | Key file or explicit option/env; must be backed up and access-restricted |
| Admin password | Constant-time SHA-256 comparison; server environment/session only |
| Prompts / answers | Sensitive runtime data; content logging disabled |
| Usage metadata | Optional monthly counts/tokens/timing; no content or credentials |

## 2. Threats and current controls

### 2.1 Server-Side Request Forgery (SSRF)

Provider URLs default to HTTPS; socket-level DNS lookup rejects loopback/private/link-local IPv4/IPv6 and redirects are blocked. Explicit `allowedPrivateHosts` permits LAN destinations; `allowLocalHttp` retains the local-development exception. With a proxy, DNS is remote: known catalog domains plus explicit `allowedHosts` replace local socket IP filtering. Admin-controlled URL changes still require validation.

### 2.2 Cross-Site Request Forgery (CSRF)

Mutating HTTP endpoints require `X-LLM-CSRF: 1`. Cross-origin access needs CORS approval; wildcard never grants credentialed management access. CSP and X-Frame-Options prevent framing. Host applications remain responsible for session cookies/SameSite and their own endpoints.

### 2.3 Credential & Secret Leakage

Public profile DTOs expose hasApiKey, not apiKey. `redact()` masks credentials/content; logContent stays false. Model preview does not echo keys; health is public but omits profile identity/secrets. Package allowlisting excludes tests/data/real.env. Internal get/getActive results must never be logged or returned directly. Browser Bearer tokens are public and grant chat only.

### 2.4 Unauthorized access and brute force

Admin and chat principals are separate; missing Web auth fails closed. Basic failure quotas default to 10/min; chatAccess is authenticated/admin/false. Rate buckets are process-local and require a correct host client identity/trust proxy configuration. Use TLS and strong passwords; public binding requires ≥12 characters.

### 2.5 Resource Exhaustion & Cost Abuse

Defaults: body 256 KiB, 100 messages, 200000 total/100000 single-message characters; provider JSON 2 MiB and SSE 8 MiB. Quotas, timeout/token bounds, admin-only overrides and upstream cancellation limit abuse. Retry/fallback share a total budget and stop once output begins. These are per-process controls, not a distributed billing ceiling.

### 2.6 Data integrity and local environment

Atomic writes, revision checks, FIFO/process locks and Windows rename retry protect local files; stale lock cleanup requires age/dead PID checks. One-generation .bak and key backups support recovery. NFS/SMB is not guaranteed; abrupt two-file rotation interruption requires a matching old pair. SDK validation disables global-tools PATH registration so temporary build directories cannot alter the user's persistent PATH.

### 2.7 Supply Chain

Threat: a malicious dependency, lockfile, CI action or publish identity can expose all protected assets.

**Current controls**:

- Runtime `undici` and optional peer `express`; development tools are separate, not risk-free.
- `npm ci` uses committed `package-lock.json`; integrity hashes detect changed bytes, not already accepted malicious code.
- CI `npm audit --omit=dev` checks known production advisories; it does not cover development dependencies or prove trust.
- `npm pack --dry-run` and files allowlisting exclude test/data/real.env content.
- There is no publishing workflow. Local release scripts test/bump/tag; action tags are mutable. Publish origin, provenance and signing are not enforced.

**Planned controls (not implemented)**:

- Formal dependency/lockfile review, including development tooling and install scripts; evaluate update monitoring.
- Pin actions to reviewed immutable commit SHAs and review pin updates.
- Define publisher credentials/source/tag policy; evaluate provenance and artifact signing before publishing automation.

---

## 3. Operator responsibilities

Use TLS, restricted service-account directories and encrypted/offline backups. On POSIX use suitable directory/file permissions; on Windows use ACLs. Keep profile and master-key backups paired. Protect host sessions and routing; do not expose trusted ask/handle calls directly to anonymous users. [Deployment](DEPLOY.md) · [Private vulnerability reporting](../SECURITY.md).
