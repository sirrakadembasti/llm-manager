# LLM Manager

Provider, profile and encrypted API-key management for **Node.js 22.12+**. Run it as a standalone server or an application plugin; Docker and a database are optional.

Package: **`@sirrakadembasti/llm-manager`**; CLI: `llm-manager`. The unscoped npm package belongs to another project. Local **2.0.0 / Unreleased** is not proof of a published npm release or Git tag.

[Türkçe](KULLANICI_KILAVUZU.md) · [Quick start](../README.md) · [Integration](ENTEGRASYON.md) · [Deployment](DEPLOY.md) · [Roadmap](roadmap/YOL_HARITASI.md)

## Start from source

In the repository, using PowerShell:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set `LLM_ADMIN_USER=admin` and `LLM_ADMIN_PASSWORD=your-strong-password` in `.env`, preserving existing settings. Run `npm start`, open **http://127.0.0.1:8010/llm** and sign in with those credentials. Save/test a provider profile and activate it. Stop with **Ctrl+C**. Linux/macOS uses the same `.env` settings and `npm ci` / `npm start` commands.

Direct GitHub CLI in a Node host with Express installed:

```sh
npx github:sirrakadembasti/llm-manager --password your-strong-password --port 8010
```

The Express adapter and CLI server require Express **4.19.2+ or 5.x**, an optional peer. Source `npm ci` includes it; core-only usage does not require Express. Use `--help` for CLI flags, including host, data directory and chat tokens. Both CLI and `npm start` read the working directory's `.env`; existing process environment values take precedence. Environment assignments do not write back to the file. Manual library integrations load environment files through their host.

On Windows, a PATH exceeding [cmd.exe's 8191-character limit](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation) can make installed Node invisible to npm scripts. Remove obsolete entries and refresh the terminal. .NET verification no longer registers temporary SDK tools paths.

## Integrate

Run in the host project:

```sh
npm install github:sirrakadembasti/llm-manager express
npx llm-manager init
```

The wizard detects the project, asks before changing files, verifies setup and opens `/llm`. Use unqualified `npx llm-manager` only after this package is installed. Unpublished local changes can be installed with `npm install "F:\projeler\llm-manager" express` on Windows.

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';
const app = express();
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD
});
app.listen(3000);
// Server code: const answer = await llm.ask('Hello');
```

For a Web Request host, create a manager from `/core` and call `llm.fetch(request)`. Direct `ask()`/`handle()` are trusted host APIs; enforce HTTP authorization in the adapter.

## Supported environments

| Environment | Type | Deployment | Separate Node process | Injection |
| --- | --- | --- | --- | --- |
| Express | express | Persistent disk/host store | No | ESM/CJS/TypeScript |
| SPA | spa | Your backend in production | Yes | HTTP client helper |
| Next.js | nextjs | App Router, Node runtime | No | Server components only |
| Nuxt | nuxt | Node server | No | No client-component import |
| SvelteKit | sveltekit | Node adapter | No | No client-component import |
| Electron | electron | Main process, userData store | No | Main process/preload |
| Tauri | tauri | HTTP client | Yes | No Rust/IPC injection |
| Fastify, Koa, Hono, NestJS | fastify/koa/hono/nestjs | Host auth + manual bridge | No | Manual |
| Python | python | HTTP client | Yes | Client import |
| .NET / .NET Framework | dotnet | HTTP client | Yes | Client namespace |

Edge is unsupported. Serverless Node deployments require a persistent host store; default local files may be ephemeral/read-only. Select one CLI type from the grouped frameworks. Static package-less SPAs only receive HTTP helpers; a Node management server still needs the package and Express.

## API and limits

Page `/llm`; API prefix `/api/llm`. Mutating requests require `X-LLM-CSRF: 1`.

| Operation | Relative route |
| --- | --- |
| Catalog / profiles | `GET /catalog`, `GET /profiles` |
| Create / update / delete | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Activate / test | `POST /profiles/:id/activate`, `POST /profiles/:id/test` |
| Models / unsaved preview | `GET /profiles/:id/models`, `POST /models/preview` |
| Chat | `POST /chat`: `{ prompt }` or `{ messages }` |
| Health / usage | `GET /health`, `GET /usage?month=YYYY-MM` |

`ask()` returns a string; `{ raw: true }` returns usage, finishReason, actual profile and timing metadata. `stream()` is an AsyncIterable; HTTP `{ stream: true }` emits SSE delta/done/error. `done` includes `profileId`/`fallbackUsed`. Client disconnection cancels upstream work; direct callers may pass `signal`. Hidden reasoning is excluded from answer text; filters/truncation produce typed errors.

Retry handles only retryable failures, before the first emitted chunk, respecting backoff and Retry-After. No replay or fallback after output. All attempts/fallbacks share the initial profile's total timeout; `retry: false` disables retries.

| Setting | Default / range |
| --- | --- |
| `limits.maxMessages` | 100 |
| `limits.maxChars` / `maxSingleMessageChars` | 200000 total / 100000 per message |
| `limits.maxBodyBytes` | 262144; Express `bodyLimit` takes precedence |
| Message roles | system/user/assistant, with a user message |
| `timeoutMs` / `maxOutputTokens` | 120000 ms (5000–300000) / 8192 (256–32768) |
| Advanced | temperature 0–2, topP 0–1, stop ≤4 strings, responseFormat text/json |
| `thinking` | auto/enabled/disabled, model-dependent |
| `chatAccess` / `chatOverrides` | authenticated/admin/false; admin/all/none (default admin) |
| Rate limits | Chat 30/min; test 10/min; models/preview 10/min; auth failures 10/min |

Invalid messages: 400 MESSAGES_INVALID; invalid JSON: 400 BODY_INVALID; oversized body: 413 BODY_TOO_LARGE. Express parses after auth; an earlier host parser may impose a smaller limit. Advanced settings must match the selected model's capabilities.

Custom stores implement `list`, `get`, `getActive`, `save`, `remove`, `activate`, `recordTest`. File-store methods return Promises; host methods may return `T | Promise<T>`. Only internal `get`/`getActive` results contain keys. Public results stay secret-free. Updates/deletes/activation require revision; mismatch is PROFILE_CONFLICT/409, missing profile PROFILE_NOT_FOUND/404. Preserve atomic compare-and-write and null-on-stale test recording. [Detailed contract and async memory example](ENTEGRASYON.md#özel-depo).

## Authentication and privacy

Management pages/scripts/API require Basic admin or an admin host principal. Missing Web configuration fails closed with AUTH_NOT_CONFIGURED. Supply `authorize(request)` for a host identity; per-call fetch options override defaults. Bearer chatTokens/LLM_CHAT_TOKENS allow chat only; `chatAccess: 'admin'` excludes them. `insecureNoAuth: true` is an explicit insecure local opt-in.

Quotas use clientKey or Web `getClientId(request)` (Express req.ip), then `principal.id`, then a shared anonymous bucket. Use stable identity; changing profiles does not reset model/test quotas. Express hosts configure `trust proxy`. 429 includes Retry-After; `rateLimit: false` disables quotas. Buckets are process-local, not distributed; auth failures are limited before principal identity exists.

Browser tokens are public: use your backend in production. Wizard passwords stay in `.env`, SPA development tokens in `.env.local`, and secret files are ignored by Git. Vite gets localhost:5173; other projects need explicit origins. `-y` without one leaves CORS closed. Wizard rejects `*`; CLI wildcard is chat-only without credentials.

HTTPS and DNS/socket SSRF filtering apply by default. `allowedPrivateHosts` explicitly permits LAN/Ollama hosts; `allowLocalHttp` is the existing loopback development option. `proxyUrl`/LLM_HTTPS_PROXY moves DNS to the proxy, so local IP filtering is unavailable: destinations are restricted to known catalog domains and explicit `allowedHosts`.

`logger` redacts secrets/content and correlates request IDs. `logContent: false` is fixed and cannot be enabled. `chat.completed` records code, safe usage (null if unknown) and final candidate once per logical chat, including failure, cancellation and early iterator return. Legacy chat.stream.completed success remains. `usageLog: true` writes numeric monthly JSONL; `/usage` is admin-only. Public `/health` is secret-free; `health: false` disables it. UI options: locale tr/en and homeUrl; the server message dictionary does not translate every HTTP error.

## Storage and operations

Back up `llm-profiles.json` and `llm-encryption.key` **together**; lost keys cannot decrypt profiles. AES-256-GCM protects stored keys. Use Windows service-account ACLs; POSIX 0600 alone does not secure Windows files. File-store FIFO writes use local process locks; NFS/SMB guarantees are excluded.

```sh
npx llm-manager key rotate
npx llm-manager export --out backup.json --password backup-password
npx llm-manager import backup.json --password backup-password
```

Key priority: explicit encryptionKey > LLM_CONFIG_ENCRYPTION_KEY > key file. Default setup migrates a legacy key to the file under lock, leaving `.env` unchanged. Deprecated `writeEnv: true` preserves legacy writing. Rotation backs up `llm-encryption.key.old-<date>-<id>`.

`STORE_DECRYPT_FAILED` means the saved API key could not be decrypted. An old `.env` key can override the correct key file. Back up `.env`, profiles and the key first. Only after verifying that the key file decrypts existing profiles, remove the conflicting `.env` override and restart. Generating a new key cannot recover existing ciphertext; corrupted ciphertext can cause the same error.

`auth.failed` records a request with missing or incorrect management credentials. A browser's initial Basic Auth challenge or cached old password can trigger it; it is separate from provider access.

STORE_CORRUPT and STORE_VERSION_UNSUPPORTED return typed500 errors and UI recovery guidance. Preserve the damaged/newer file and its key; restore a matching good `.bak` for corruption, or use a compatible version for newer data. Do not overwrite with an empty store.

CLI/example processes own SIGINT/SIGTERM shutdown with a limit of 10 seconds. Programmatic factories/probes/init leave host signals alone by default. Use `handleSignals: true` only for an owned standalone process; embedded hosts call `await instance.close()`. [Docker, PM2, systemd, NSSM and recovery](DEPLOY.md).

## Models and diagnostics

The suggestion catalog is dated **2026-10-24**, not a live account guarantee. Use **Modelleri getir** for account/region-specific discovery; [dated sources](roadmap/YOL_HARITASI.md#katalog-kaynakları) retain exact IDs and transport caveats. Some current models cannot disable thinking.

For MiMo auto thinking, `purpose: 'diagnostic'` and `purpose: 'quick'` disable thinking; `purpose: 'default'` preserves model defaults. Explicit diagnostic/default choices are retained, but MiMo quick tests disable even explicit thinking. Passing a diagnostic does not guarantee provider latency or production behavior. Quota, permission, network, empty/filter/truncation failures use separate codes. [Xiaomi's contract](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

## Package subpaths and migration

| Import | Purpose |
| --- | --- |
| `@sirrakadembasti/llm-manager` | Express and core APIs |
| `@sirrakadembasti/llm-manager/core` | Framework-independent manager/store |
| `@sirrakadembasti/llm-manager/server` | Standalone server |
| `@sirrakadembasti/llm-manager/init` | Detection, injection, verification, rollback |
| `@sirrakadembasti/llm-manager/setup` | Key management |
| `@sirrakadembasti/llm-manager/runtime` | Requests, generation, errors |
| `@sirrakadembasti/llm-manager/transport` | Safe provider HTTP |
| `@sirrakadembasti/llm-manager/errors` | Typed error codes |

To move from 1.x, uninstall the old unscoped package and install this repository; update imports and await file-store calls. CLI/data/key files remain. The synchronous functions below were removed from the root:

```js
import { detectProjectType, detectEntryFile, formatVerificationReport } from '@sirrakadembasti/llm-manager/init';
```

Root async runInteractiveInit/probeAndOpenBrowser/initLLMProject/verifyIntegration/injectIntoEntryFile wrappers are deprecated for one compatibility release; use `/init` in new code. Legacy `manager` maps to `diagnostic`, `production` to `default`, each warning once. Obsolete custom-generate flags are no longer forwarded.

MIT · [License](../LICENSE) · [Changes](CHANGELOG.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)
