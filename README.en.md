# LLM Manager

> The npm package `llm-manager` belongs to another project. This project is `@sirrakadembasti/llm-manager`. Use bare `npx llm-manager` only after installing this repository into your host.

Standalone LLM provider and profile management plugin for Node.js 22.12+ and Express.
Easily integrates into any host application without requiring Docker, frontend frameworks, or databases. Requires Node/npm.
Runs on Windows, Linux, and macOS using the same codebase.

## Features

> For release history, refer to [CHANGELOG.md](CHANGELOG.md). Mutating requests require the CSRF header:
> `X-LLM-CSRF: 1`.

- Built-in provider catalog (default models and regional endpoints, verified 2026-10-24; use **Fetch models** for your account’s current list) + custom OpenAI-compatible provider; select models from catalog, manually enter endpoint/model, or fetch available models dynamically from the provider.
- Profile creation, modification, deletion, and single active profile semantics; keeps existing API keys safe with a 3-state encrypted key badge and status notification.
- AES-256-GCM encryption (with mandatory 12-byte IV and 16-byte authentication tag), secure atomic file writes, revision control.
- Timeout configurable from 5–300s (default: 120s). Max output tokens: 256–32768 (default: 8192). Reasoning/thinking mode: auto/enabled/disabled across supported providers.
- Interactive Playground panel in the UI with streaming SSE response, token consumption metrics, and latency measurement.
- Multi-language UI support (Turkish & English) via `mountLLMManagement({ locale: 'tr' | 'en' })`.
- Separate quick connectivity and full conversation tests with recorded timestamps, latency, and error codes (preserved as long as credentials and endpoint remain unchanged).
- Admin authorization, CSRF protection, secure HTTP headers (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`), HTTPS provider enforcement, socket-level SSRF prevention blocking private IPv4/IPv6 ranges; zero secret leakage in logs or responses.
- In-flight request deduplication, debounce locks, timeouts, and form state preservation even while fetching remote models.

## Installation & Standalone Usage

### CLI (`npx llm-manager`)

```sh
# Interactive setup wizard (detects architecture -> injects code -> verifies integration -> launches /llm in browser)
npx github:sirrakadembasti/llm-manager init --password strong-password

# Start standalone management server directly
npx github:sirrakadembasti/llm-manager --password strong-password --port 8010
```

CLI Options: `init`, `-t/--type` (`express | spa | nextjs | nuxt | sveltekit | electron | dotnet | python | fastify | koa | hono | nestjs | tauri`), `-f/--force`, `-y/--yes` (auto-confirm), `--no-open` (do not launch browser), `-w/--password`, `-u/--user` (default: `admin`), `-c/--cors` (e.g. `http://localhost:5173` or `*`), `-p/--port`, `-h/--help`, `-v/--version`. Standalone startup also accepts `--host` (default `127.0.0.1`), `--data-dir` and `--chat-token`. Environment variables in `.env` are automatically loaded; encryption key and storage files are initialized in `./data/`.

CLI servers (including the live `init` probe) and `examples/server.js` handle SIGINT/SIGTERM by stopping new connections and waiting for active requests. Successful shutdown exits 0; failure to finish within 10 seconds exits 1. Windows hard termination may bypass Node signal handlers.

Programmatic `createStandaloneServer`, `probeAndOpenBrowser` and `runInteractiveInit` leave host signals alone by default. `handleSignals: true` opts one standalone server into owning this process shutdown/exit policy; a probe only applies it to a server it starts. Embedded hosts should keep the default and call `await instance.close()` in their own shutdown flow. Repeated `close()` calls await the same shutdown; raw `instance.server.close()` also cleans up only this server’s signal handlers and timer.

### From Source

```sh
npm ci
npm test
```

To run the sample server, configure `LLM_ADMIN_PASSWORD` (default user is `admin` unless `LLM_ADMIN_USER` is specified) and run `npm start`. The server listens strictly on `127.0.0.1:8010`; visit `/llm` in your browser.

PowerShell example (Windows):

```powershell
$env:LLM_ADMIN_PASSWORD = 'your-strong-password'
npm start
```

Enter API keys only through the admin UI. Do not commit profile files or encryption keys under `data/` to version control. Always backup profile store files alongside their corresponding **encryption keys**.

### Key Management, Rotation, and Encrypted Backups

> [!WARNING]
> **If the encryption key is lost, encrypted profiles cannot be recovered!** Always backup `data/llm-encryption.key` alongside `data/llm-profiles.json`.

If a legacy installation keeps its key only in `.env`, the default `ensureLLMEncryptionKey` call migrates it to the key file under the profile lock; `.env` and encrypted profiles remain unchanged. For this setup helper, `environment.LLM_CONFIG_ENCRYPTION_KEY` takes precedence over an existing key file, which takes precedence over the legacy `.env` value. For the file store, explicit `encryptionKey` takes precedence over `LLM_CONFIG_ENCRYPTION_KEY`, then the key file. Subsequent embedded processes can read the same profiles without loading `.env`. Legacy `.env` writing requires deprecated `{ writeEnv: true }`. Rotation backups use `llm-encryption.key.old-<date>-<unique-id>`.

```sh
# 1. Rotate encryption key (generates new key, re-encrypts all saved API keys under lock, backups old key):
npx llm-manager key rotate

# 2. Export profiles to an encrypted portable backup file (encrypted with password via scrypt/AES-GCM):
npx llm-manager export --out backup.json --password backup-password

# 3. Import profiles from an encrypted backup:
npx llm-manager import backup.json --password backup-password
```

## Integration into Existing Projects (Zero-Config)

Install the package:

```sh
npm install github:sirrakadembasti/llm-manager
```

The encryption key and `data/` directory are generated automatically on startup; simply mount the plugin and query with `llm.ask()`:

```js
import express from 'express';
import { mountLLMManagement } from '@sirrakadembasti/llm-manager';

const app = express();
app.use(express.json({ limit: '32kb' }));

// 1. Mount the plugin (specify adminPassword for built-in basic auth, or requireAuth for custom middleware):
const llm = mountLLMManagement(app, {
  adminPassword: process.env.LLM_ADMIN_PASSWORD // or requireAuth: (req, res, next) => ...
});

// 2. Query the active model with a single call (API keys are never exposed to the client):
const answer = await llm.ask('Provide a brief summary.', {
  system: 'You are a helpful assistant.'
});
```

If you have a custom `generate(messages, options)` adapter, pass it in `mountLLMManagement({ generate })`. You can also configure `dataDir` (e.g. `app.getPath('userData')` in Electron) or provide a custom `store`.

The plugin automatically applies `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and strict `Content-Security-Policy` headers to its UI and API endpoints. Async router/store errors on Express 4 are forwarded to host error handlers via `next(err)`. Mutating endpoints require `X-LLM-CSRF: 1`.

### Non-Express Integrations (Next.js, Nuxt, SvelteKit, Vue/React SPA, C#/.NET, Python, Desktop)

After installing this repository into the host, run `npx llm-manager init`. The wizard detects the stack and entry file, asks before modifying files, verifies generated syntax/connectivity and opens `/llm`. Without an explicit password it generates a strong random password and stores it only in `.env`. This does not promise a complete host scaffold or production readiness.

| Application Type | Detection (`--type`) | Generated Files | Integration Boundary | How to Ask Questions |
| --- | --- | --- | --- | --- |
| Express | `express` | `llm.js` | `server.js` / `app.js` / `index.js` | `await askLLM('Hello')` |
| SPA | `spa` | `src/llm.js` | React/Vue/Vite/Angular/Svelte HTTP helper | `await askLLM('Hello')` |
| Next.js | `nextjs` | `llm.js` + `app/llm` & `app/api/llm` | App Router server components only | `await askLLM('Hello')` |
| Nuxt | `nuxt` | `server/utils/llm.js` + server routes | Server routes, never client components | Server `askLLM`; client HTTP |
| SvelteKit | `sveltekit` | `src/lib/server/llm.js` + `+server.js` | Server routes, never client components | Server `askLLM`; client HTTP |
| Electron | `electron` | `llm.js` + `preload.cjs` | Main process; preload bridge | `await window.llm.ask('Hello')` |
| Tauri | `tauri` | `llm.js` | SPA HTTP client; server: `npm run llm` | `await askLLM('Hello')` |
| Fastify, Koa, Hono and NestJS | `fastify/koa/hono/nestjs` | `llm.js` | Manual bridge; no automatic framework injection | Server `llm.fetch(request)` / `llm.handle(...)` |
| Python | `python` | `llm_client.py` | Flask/FastAPI/Django helper import | `ask_llm("Hello")` |
| .NET and .NET Framework | `dotnet` | `LlmClient.cs` | Web/desktop helper namespace | `await LlmClient.AskAsync("Hello")` |

Express supports ESM/CommonJS and TypeScript. Choose one CLI type for the manual framework group, for example `--type hono`. .NET 4.0 callers use `Task` continuations (`ContinueWith`); `await` examples require modern/.NET 4.5+ targets. See the integration guide for target-specific client selection. Generated client credentials are public: use your own authenticated backend in production.

For detailed step-by-step guides, consult **[docs/ENTEGRASYON.md](docs/ENTEGRASYON.md)**.

```js
import { createLLMManager } from '@sirrakadembasti/llm-manager/core';

const llm = createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD }); // data/ and key are auto-created

// Direct question invocation:
const reply = await llm.ask('Hello!');

// Next.js / SvelteKit / Hono standard Web Request -> Response adapter:
const response = await llm.fetch(request);
```

## Supported environments

| Environment | Type | Production deployment | Separate Node process | Automatic injection |
| --- | --- | --- | --- | --- |
| Express | express | Persistent disk/host store | No | Yes |
| SPA | spa | Through your own backend recommended | Yes | HTTP client helper |
| Next.js | nextjs | Node runtime + persistent disk/host store | No | Server components only |
| Nuxt | nuxt | Node server | No | Never into client components |
| SvelteKit | sveltekit | Node adapter + persistent store | No | Never into client components |
| Electron | electron | Main process, userData store | No | Main process |
| Tauri | tauri | HTTP client | Yes | No |
| Fastify, Koa, Hono and NestJS | fastify/koa/hono/nestjs | Host auth adapter | No | No; manual bridge |
| Python | python | HTTP client | Yes | Helper import |
| .NET and .NET Framework | dotnet | HTTP client | Yes | Helper namespace |

Serverless requires Node runtime and a persistent host store; Edge is unsupported. SPA/Tauri/Python/.NET clients connect over HTTP to a separately running management server. Express 4.19.2+ and 5.x are supported (`^4.19.2 || ^5.0.0`). Express is an optional peer, required separately for the Express adapter or CLI management server. A package-free static SPA generates only an HTTP client; `npm run llm` needs this package and Express installed on the Node host. Do not bundle core/store/key APIs into browser code.

## API & Store Contract

Default base route `/api/llm`:

| Operation | Path |
| --- | --- |
| Catalog & profiles | `GET /catalog`, `GET /profiles` |
| Create / Update / Delete | `POST /profiles`, `PUT /profiles/:id`, `DELETE /profiles/:id` |
| Activate | `POST /profiles/:id/activate` |
| Test | `POST /profiles/:id/test`, JSON `{ "mode": "quick" }` or `conversation` |
| Model list / unsaved preview | `GET /profiles/:id/models`, `POST /models/preview` |
| Model completion (Runtime) | `POST /chat`, JSON `{ "prompt": "..." }` or `{ "messages": [...] }` |
| Health check | `GET /health` |
| Monthly usage statistics | `GET /usage?month=YYYY-MM` |

The `POST /chat` endpoint executes calls server-side using the active profile (or an optional `profileId`) and returns `{ ok: true, content, profileId, profileName, provider, model, durationMs, usage }`. API keys are never leaked to clients.
Access level can be configured via `chatAccess`: `'authenticated'` (default: any authenticated user), `'admin'` (admins only), or `false` (disabled).

A custom store implementation can be provided instead of `createLLMProfileStore`: `list`, `get`, `getActive`, `save`, `remove`, `activate`, `recordTest(id, status, expectedRevision, details)`. `get` returns the decrypted `apiKey` exclusively server-side; `list` and `save` must never expose keys. Missing profiles yield `code: 'PROFILE_NOT_FOUND'` (`HTTP 404`), revision mismatches return `code: 'PROFILE_CONFLICT'` (`HTTP 409`). Multi-process file locking ensures integrity across worker processes on standard POSIX/Windows file systems.

### Request, runtime and store limits

`ask(promptOrMessages, options)` returns a string; `{ raw: true }` returns `ChatResult` with `usage`, `finishReason` and profile/timing metadata. `stream()` returns an `AsyncIterable` of `delta` and `done` chunks. HTTP `POST /chat` accepts `{ stream: true }` and sends SSE `delta`, `done` or `error` events; disconnecting the Web/Express client cancels upstream work. Supply `signal` for direct cancellation. Reasoning content is never exposed as the final answer.

| Option | Default / contract |
| --- | --- |
| `limits.maxMessages` | 100 |
| `limits.maxChars` | 200000 total message characters |
| `limits.maxSingleMessageChars` | 100000 |
| `limits.maxBodyBytes` | 262144 bytes for Web JSON bodies; Express uses `bodyLimit`, then `limits.maxBodyBytes`, then 262144 bytes |
| `chatOverrides` | `'admin'`; also `'all'` or `'none'` |
| `rateLimit` | Chat 30/min, tests 10/min, model list/preview 10/min, auth failures 10/min; `false` disables |
| Runtime options | `timeoutMs` 5000–300000; `maxOutputTokens` 256–32768; `thinking` auto/enabled/disabled |
| Advanced options | `temperature` 0–2, `topP` 0–1, `stop` up to 4 strings, `responseFormat` text/json |

Messages must have nonempty string content, roles `system | user | assistant` and at least one `user` message; invalid input returns 400 `MESSAGES_INVALID`. Invalid JSON returns 400 `BODY_INVALID`; oversized bodies return 413 `BODY_TOO_LARGE`. The Express adapter parses its own JSON after authentication; any earlier host parser may impose a smaller limit (the example above uses `32kb`). Non-admin callers cannot override profile/runtime cost settings under the default policy. `chatAccess: false` disables HTTP chat. Trusted direct host calls remain the host’s responsibility.

All file-store methods return Promises; custom stores may return `T | Promise<T>`:

| Method | Return / required behavior |
| --- | --- |
| `list()` | `{ version: 1, activeId, profiles }`, public profiles only |
| `get(id)`, `getActive()` | Internal profile including key/transport, or null; server only |
| `save(input)` | Public profile; new profiles need name/provider/model/baseURL/apiKey |
| `remove(id, revision)`, `activate(id, revision)` | Updated list (`remove` may return `{ ok: true }` for host stores) |
| `recordTest(id, status, expectedRevision, details)` | Public profile, or null if revision changed during the test |

Updates require `id` and current `revision`; DELETE/activate require `revision` in the JSON body. Explicit `null` from a legacy revisionless record is valid for its first mutation; omitting the field is not. Revision comparison and writes must be atomic. Empty/omitted update keys preserve the old key, but changing provider/baseURL requires a new key (`AI_CREDENTIAL_ENDPOINT_MISMATCH`). Credential/endpoint/model changes reset test history; name/runtime-limit changes preserve it. `recordTest` does not change revision; status is `passed | failed` and details contain mode, durationMs and optional code. Keep `list`, `save`, `remove`, `activate` and `recordTest` secret-free; never send internal `get` results to a client or logger. Use secret-free errors with stable codes, preferably `LLMError`.

The file store serializes writes with FIFO and a five-second local process-lock deadline (`STORE_LOCKED`). NFS/SMB guarantees are excluded. The dependency-free [memory-store example](examples/memory-store.js) shows an async custom store; it is single-process, loses data at restart and holds plaintext keys in memory. Persistence/encryption are the host’s responsibility.

A corrupt profile file returns HTTP 500 `STORE_CORRUPT`; a newer unsupported store version returns 500 `STORE_VERSION_UNSUPPORTED`. Existing files/backups are left intact; do not overwrite them with an empty store. Preserve the damaged/newer file and matching encryption key, then restore a known-good `llm-profiles.json.bak` over `llm-profiles.json` for corruption, or use a compatible application version for a newer format. The UI shows recovery guidance; the public health response hides store details. Keep backups paired with their encryption key. POSIX 0600 permissions do not secure Windows files: restrict `data/` to the application account with Windows ACLs.

`testMessages(mode, profile)` and `validateTestReply(reply, { mode, profile })` support host-specific diagnostics. The default conversation test asks a neutral web authentication question. The supplied internal profile contains secrets: never log it. Keys are not automatically transferred to another service.

### Enterprise Proxy and LAN Models (SSRF Security)

- **Corporate Proxy (`proxyUrl` / `LLM_HTTPS_PROXY`):** Outgoing API requests can be routed through an enterprise HTTPS proxy via `proxyUrl`. Proxy DNS resolution happens at the proxy, so the local socket DNS filter does not apply. To compensate, destination addresses are restricted strictly to **known catalog provider domains** and explicitly configured `allowedHosts` (`LLM_DNS_BLOCKED`).
- **Local / LAN Model Servers (`allowedPrivateHosts` / `LLM_ALLOWED_PRIVATE_HOSTS`):** Connect to local Ollama, LM Studio, or vLLM instances (`http://192.168.1.50:11434`, `http://ollama.lan`) by configuring `allowedPrivateHosts: ['192.168.1.50:11434', 'ollama.lan']`. Only explicitly listed hosts bypass the private IP / HTTP restriction; all other endpoints strictly enforce HTTPS and SSRF protection.

## License & Versioning

MIT License ([LICENSE](LICENSE)). Follows [Semantic Versioning](https://semver.org/).
To release a version: `npm run release:patch|minor|major` (runs verification suite, bumps version, updates changelog, and creates git tag).

### Web authentication

Configure `createLLMManager({ adminPassword: process.env.LLM_ADMIN_PASSWORD, chatTokens: process.env.LLM_CHAT_TOKENS })` for Web routes. Management pages, scripts and APIs require an admin principal. Missing configuration fails closed with `AUTH_NOT_CONFIGURED`. A host can provide `authorize: async request => principal | null`; per-call `fetch(request, options)` settings override defaults. Bearer tokens can call POST /chat only; `chatAccess: 'admin'` excludes them. Browser-visible tokens are public; use your own backend in production. `insecureNoAuth: true` is an explicit insecure local opt-in. Direct `ask()` and `handle()` are trusted host APIs.

Chat/test/model quotas use host `clientKey` / Web `getClientId(request)` first (Express uses `req.ip`), then `principal.id`, then a shared anonymous bucket. Provide a stable `principal.id` to separate Web users when no client ID is supplied. Switching profiles does not reset test/model quotas; model preview and saved model discovery share a bucket, while chat has its own bucket. Express hosts own their `trust proxy` configuration. HTTP 429 includes `Retry-After`; `rateLimit: false` disables quotas. These in-memory buckets are process-local, not distributed quotas. Web Basic-auth failure limiting uses `getClientId(request)` or a shared anonymous bucket; it runs before a principal exists.

SPA/Tauri init uses `http://localhost:5173` when Vite is detected; otherwise it asks for an origin. In `-y` mode CORS stays closed without an explicit origin. Supply explicit http/https origins through `LLM_ALLOWED_ORIGINS` or init `allowedOrigins`; the wizard rejects `*`.

The installer stores credentials in ignored environment files, keeps secrets out of generated source and npm scripts, and preserves existing generated credentials on repeated runs.

## Migrating from 1.x to 2.0

The npm package named `llm-manager` belongs to another project. Bare `npx llm-manager` examples in this document mean the local executable **after installing this repository into the host**. The local 2.0 version does not imply an npm release or a published Git tag.

Run `npm uninstall llm-manager`, then `npm install github:sirrakadembasti/llm-manager`; change imports to `@sirrakadembasti/llm-manager`. The CLI name and existing data/key files remain unchanged. Await every file-store method; custom stores may return values or Promises. Use the `/init` subpath for synchronous wizard APIs. Key-file creation is the default; legacy `.env` writing requires deprecated `writeEnv: true`.

The catalog was verified on 2026-10-24; unverified suggestions were removed. Use model discovery for your account. [Primary source evidence and transport limits](docs/roadmap/CATALOG_SOURCES_2026-10-24.md) are recorded. Current always-on reasoning models reject unsupported disabled mode explicitly.

Purposes are `quick | diagnostic | default`; legacy manager/production aliases warn once. Custom generate callbacks no longer receive useManagedProfile/allowMockFallback. File stores use asynchronous I/O, FIFO writes and a five-second process-lock acquisition deadline on local disks. NFS/SMB guarantees are excluded. Keep keys backed up: lost keys cannot decrypt profiles. On Windows use service-account ACLs, not POSIX mode bits alone.

Optional `usageLog: true` (`LLM_USAGE_LOG=true`) stores safe numeric usage/timing in monthly `data/usage-YYYY-MM.jsonl`, never prompt/response content. `logger` correlates sanitized request IDs and redacts content/secrets. `logContent: false` is fixed; content logging cannot be enabled. `chat.completed` reports usage (null if unknown), code and final profile/model once per provider chat, including streaming success, failure, cancellation and early iterator return. Only observed safe token counts are recorded; the legacy `chat.stream.completed` success event remains. Fallback runs only for retryable failures, in configured order, sharing the profile’s total timeout budget with retries; `retry: false` disables automatic retries. `/usage` is admin-only; `/health` is public and secret-free unless disabled. `locale: 'tr' | 'en'` and `homeUrl` configure the UI. `createUiAssets` renders `lang` and `data-locale`; `MESSAGES` / `getErrorMessage(code, locale)` provide a server message dictionary with stable codes. This is not full HTTP error localization; existing Turkish HTTP errors remain. [Integration details](docs/ENTEGRASYON.md) describe supported frameworks, server-only boundaries, rollback and compiler checks.

## Latency and external failures

For MiMo in automatic thinking mode, `purpose: 'diagnostic'` and `purpose: 'quick'` disable deep thinking via `resolveRuntimeOptions` for built-in requests and custom `generate` adapters. `purpose: 'default'` preserves model defaults. Explicit thinking selection is preserved for diagnostic/default calls; MiMo quick tests disable thinking even when explicitly enabled. This cannot guarantee provider speed. Quota/429, provider overload/5xx, permission/401–403, DNS/proxy/network issues and empty/truncated answers have distinct error codes. A successful diagnostic records that test moment, not production acceptance. Only the final answer is shown, never hidden reasoning. See [Xiaomi’s thinking contract](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking).

## Package subpaths and synchronous export migration

| Import | Purpose |
| --- | --- |
| `@sirrakadembasti/llm-manager` | Express `mountLLMManagement` and core APIs |
| `@sirrakadembasti/llm-manager/core` | Framework-independent `createLLMManager`, `createUiAssets`, store APIs |
| `@sirrakadembasti/llm-manager/server` | `createStandaloneServer` and owned shutdown option |
| `@sirrakadembasti/llm-manager/init` | Wizard, detection, injection, verification and live probe APIs |
| `@sirrakadembasti/llm-manager/setup` | `ensureLLMEncryptionKey` |
| `@sirrakadembasti/llm-manager/runtime` | Provider requests, generation and error classification |
| `@sirrakadembasti/llm-manager/transport` | SSRF/DNS-rebinding protected `providerFetch`, `createPublicLookup` |
| `@sirrakadembasti/llm-manager/errors` | `LLMError`, `ErrorCodes`, stable error types |

In 2.0, synchronous `detectProjectType`, `detectEntryFile` and `formatVerificationReport` exports were removed from the root. Change their import to:

```js
import { detectProjectType, detectEntryFile, formatVerificationReport } from '@sirrakadembasti/llm-manager/init';
```

The root’s lazy async wrappers `runInteractiveInit`, `probeAndOpenBrowser`, `initLLMProject`, `verifyIntegration` and `injectIntoEntryFile` are deprecated and retained for one compatibility release. Import these from `/init` in new code too. Package distribution excludes user data and keys. This English README is a local repository artifact; these changes do not publish a package, tag or release.
